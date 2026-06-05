#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#define _WIN32_WINNT 0x0A00
#define _CRT_SECURE_NO_WARNINGS

#include "httplib.h"

#include "World-master/src/world/harvest.h"
#include "World-master/src/world/cheaptrick.h"
#include "World-master/src/world/d4c.h"
#include "World-master/src/world/synthesis.h"
#include "World-master/src/world/stonemask.h"
#include "World-master/src/world/codec.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

// ---------------------------------------------------------------------------
// WAV I/O
// ---------------------------------------------------------------------------

struct WavFile {
    int    sample_rate    = 0;
    int    channels       = 1;
    int    bits_per_sample = 16;
    std::vector<double> samples;  // mono, [-1, 1]
};

static uint16_t read_u16(const uint8_t* p) {
    return (uint16_t)(p[0] | (p[1] << 8));
}
static uint32_t read_u32(const uint8_t* p) {
    return (uint32_t)(p[0] | (p[1]<<8) | (p[2]<<16) | (p[3]<<24));
}
static void write_u16(std::vector<uint8_t>& b, uint16_t v) {
    b.push_back(v & 0xff); b.push_back((v >> 8) & 0xff);
}
static void write_u32(std::vector<uint8_t>& b, uint32_t v) {
    b.push_back(v & 0xff); b.push_back((v>>8)&0xff);
    b.push_back((v>>16)&0xff); b.push_back((v>>24)&0xff);
}

WavFile parse_wav(const std::string& data) {
    const auto* d = reinterpret_cast<const uint8_t*>(data.data());
    size_t sz = data.size();

    if (sz < 44 ||
        memcmp(d,     "RIFF", 4) != 0 ||
        memcmp(d + 8, "WAVE", 4) != 0)
        throw std::runtime_error("Not a valid WAV file");

    // Find fmt chunk
    size_t pos = 12;
    uint32_t sample_rate = 0, byte_rate = 0;
    uint16_t channels = 0, bits = 0, audio_fmt = 0, block_align = 0;
    uint32_t data_size = 0;
    const uint8_t* pcm_data = nullptr;

    while (pos + 8 <= sz) {
        char chunk_id[5] = {};
        memcpy(chunk_id, d + pos, 4);
        uint32_t chunk_sz = read_u32(d + pos + 4);
        pos += 8;

        if (strcmp(chunk_id, "fmt ") == 0) {
            if (chunk_sz < 16) throw std::runtime_error("fmt chunk too small");
            audio_fmt   = read_u16(d + pos);
            channels    = read_u16(d + pos + 2);
            sample_rate = read_u32(d + pos + 4);
            byte_rate   = read_u32(d + pos + 8);
            block_align = read_u16(d + pos + 12);
            bits        = read_u16(d + pos + 14);
        } else if (strcmp(chunk_id, "data") == 0) {
            data_size = chunk_sz;
            pcm_data  = d + pos;
        }
        pos += chunk_sz;
        if (chunk_sz & 1) pos++;  // padding byte
    }

    if (!pcm_data) throw std::runtime_error("No data chunk found");
    if (audio_fmt != 1) throw std::runtime_error("Only PCM WAV supported");

    WavFile wav;
    wav.sample_rate     = (int)sample_rate;
    wav.channels        = (int)channels;
    wav.bits_per_sample = (int)bits;

    int total_samples = data_size / (bits / 8);
    int n_frames      = total_samples / channels;
    wav.samples.resize(n_frames);

    for (int i = 0; i < n_frames; i++) {
        double v = 0.0;
        if (bits == 16) {
            int16_t s = (int16_t)read_u16(pcm_data + i * channels * 2);
            v = s / 32768.0;
        } else if (bits == 32) {
            int32_t s = (int32_t)read_u32(pcm_data + i * channels * 4);
            v = s / 2147483648.0;
        } else if (bits == 24) {
            const uint8_t* p = pcm_data + i * channels * 3;
            int32_t s = p[0] | (p[1]<<8) | (p[2]<<16);
            if (s & 0x800000) s |= 0xFF000000;
            v = s / 8388608.0;
        }
        if (channels > 1) {
            // Take only first channel for simplicity
        }
        wav.samples[i] = v;
    }

    return wav;
}

std::vector<uint8_t> encode_wav(const std::vector<double>& samples, int sr) {
    std::vector<uint8_t> out;
    out.reserve(44 + samples.size() * 2);

    uint32_t data_sz = (uint32_t)(samples.size() * 2);
    uint32_t file_sz = 36 + data_sz;

    out.insert(out.end(), {'R','I','F','F'});
    write_u32(out, file_sz);
    out.insert(out.end(), {'W','A','V','E'});
    out.insert(out.end(), {'f','m','t',' '});
    write_u32(out, 16);
    write_u16(out, 1);       // PCM
    write_u16(out, 1);       // mono
    write_u32(out, (uint32_t)sr);
    write_u32(out, (uint32_t)(sr * 2));  // byte rate
    write_u16(out, 2);       // block align
    write_u16(out, 16);      // bits per sample
    out.insert(out.end(), {'d','a','t','a'});
    write_u32(out, data_sz);

    for (double s : samples) {
        double clamped = std::max(-1.0, std::min(1.0, s));
        int16_t v = (int16_t)(clamped * 32767.0);
        write_u16(out, (uint16_t)v);
    }

    return out;
}

// ---------------------------------------------------------------------------
// Voice parameter tables (from SKILLS.md)
// ---------------------------------------------------------------------------

struct VoiceParams {
    double f0_multiplier;    // relative to "neutral"
    double formant_ratio;    // spectral envelope stretch factor
    double aperiodicity_scale;
};

VoiceParams get_params(const std::string& voice_type, int age,
                       const std::string& timbre) {
    VoiceParams p{1.0, 1.0, 1.0};

    if (voice_type == "male") {
        p.f0_multiplier   = 0.85;
        p.formant_ratio   = 0.90;
        p.aperiodicity_scale = 0.8;
    } else if (voice_type == "female") {
        p.f0_multiplier   = 1.70;
        p.formant_ratio   = 1.15;
        p.aperiodicity_scale = 1.1;
    } else if (voice_type == "child") {
        double age_clamped = std::max(5.0, std::min(15.0, (double)age));
        double t = (15.0 - age_clamped) / 10.0;  // 0 = age 15, 1 = age 5
        p.f0_multiplier   = 2.2 + 0.6 * t;       // 2.2 – 2.8
        p.formant_ratio   = 1.4 + 0.2 * t;       // 1.4 – 1.6
        p.aperiodicity_scale = 0.9;
    }

    // Age adjustment for male/female (±2% per decade from 30)
    if (voice_type != "child") {
        double age_factor = 1.0 + (30.0 - (double)age) * 0.002;
        p.f0_multiplier *= age_factor;
    }

    // Timbre: scales formant_ratio
    if (timbre == "low")  p.formant_ratio *= 0.93;
    else if (timbre == "high") p.formant_ratio *= 1.07;
    // "medium" = no change

    return p;
}

// ---------------------------------------------------------------------------
// Spectral envelope formant shift
// ---------------------------------------------------------------------------

void shift_formants(double** spec, int f0_len, int fft_size, double ratio) {
    int half = fft_size / 2 + 1;
    std::vector<double> tmp(half);

    for (int i = 0; i < f0_len; i++) {
        for (int j = 0; j < half; j++) {
            double src = j / ratio;
            int lo = std::max(0, std::min(half - 2, (int)src));
            double frac = src - lo;
            tmp[j] = spec[i][lo] * (1.0 - frac) + spec[i][lo + 1] * frac;
        }
        memcpy(spec[i], tmp.data(), sizeof(double) * half);
    }
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

std::vector<uint8_t> process(const std::string& wav_bytes,
                              const std::string& voice_type,
                              int age,
                              const std::string& timbre) {
    WavFile wav = parse_wav(wav_bytes);
    if (wav.samples.empty()) throw std::runtime_error("Empty audio");

    const int x_len = (int)wav.samples.size();
    const int fs    = wav.sample_rate;
    const double frame_period = 5.0;  // ms

    double* x = wav.samples.data();

    // ---- F0 estimation (Harvest) ----
    HarvestOption h_opt{};
    InitializeHarvestOption(&h_opt);
    h_opt.frame_period = frame_period;
    h_opt.f0_floor     = 50.0;
    h_opt.f0_ceil      = 1100.0;

    int f0_len = GetSamplesForHarvest(fs, x_len, frame_period);
    std::vector<double> temporal_pos(f0_len);
    std::vector<double> f0(f0_len);

    Harvest(x, x_len, fs, &h_opt, temporal_pos.data(), f0.data());
    StoneMask(x, x_len, fs, temporal_pos.data(), f0.data(), f0_len, f0.data());

    // ---- Spectral envelope (CheapTrick) ----
    CheapTrickOption ct_opt{};
    InitializeCheapTrickOption(fs, &ct_opt);
    const int fft_size = ct_opt.fft_size;
    const int half     = fft_size / 2 + 1;

    double** spectrogram = new double*[f0_len];
    for (int i = 0; i < f0_len; i++) spectrogram[i] = new double[half];

    CheapTrick(x, x_len, fs, temporal_pos.data(), f0.data(), f0_len,
               &ct_opt, spectrogram);

    // ---- Aperiodicity (D4C) ----
    D4COption d4c_opt{};
    InitializeD4COption(&d4c_opt);

    double** aperiodicity = new double*[f0_len];
    for (int i = 0; i < f0_len; i++) aperiodicity[i] = new double[half];

    D4C(x, x_len, fs, temporal_pos.data(), f0.data(), f0_len,
        fft_size, &d4c_opt, aperiodicity);

    // ---- Modify F0 and formants ----
    VoiceParams vp = get_params(voice_type, age, timbre);

    std::vector<double> f0_mod(f0_len);
    for (int i = 0; i < f0_len; i++) {
        f0_mod[i] = (f0[i] > 0.0) ? f0[i] * vp.f0_multiplier : 0.0;
    }

    shift_formants(spectrogram, f0_len, fft_size, vp.formant_ratio);

    // Scale aperiodicity
    for (int i = 0; i < f0_len; i++) {
        for (int j = 0; j < half; j++) {
            aperiodicity[i][j] = std::min(1.0,
                aperiodicity[i][j] * vp.aperiodicity_scale);
        }
    }

    // ---- Synthesis ----
    int y_len = (int)(f0_len * frame_period / 1000.0 * fs) + 1;
    std::vector<double> y(y_len, 0.0);

    Synthesis(f0_mod.data(), f0_len, spectrogram, aperiodicity,
              fft_size, frame_period, fs, y_len, y.data());

    // Cleanup
    for (int i = 0; i < f0_len; i++) {
        delete[] spectrogram[i];
        delete[] aperiodicity[i];
    }
    delete[] spectrogram;
    delete[] aperiodicity;

    return encode_wav(y, fs);
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

int main() {
    httplib::Server svr;

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("{\"status\":\"ok\",\"service\":\"world-service\"}", "application/json");
    });

    svr.Post("/synthesize", [](const httplib::Request& req, httplib::Response& res) {
        try {
            if (!req.form.has_file("file")) {
                res.status = 400;
                res.set_content("{\"error\":\"Missing file\"}", "application/json");
                return;
            }
            const std::string& wav_data = req.form.get_file("file").content;

            auto get_field = [&](const std::string& name, const std::string& def) -> std::string {
                return req.form.has_field(name) ? req.form.get_field(name) : def;
            };

            std::string voice_type = get_field("voice_type", "male");
            std::string timbre     = get_field("timbre", "medium");
            int age = 30;
            try { age = std::stoi(get_field("age", "30")); }
            catch (...) {}

            auto out = process(wav_data, voice_type, age, timbre);

            res.set_content(std::string(out.begin(), out.end()), "audio/wav");
        } catch (const std::exception& e) {
            res.status = 500;
            std::string msg = "{\"error\":\"";
            msg += e.what();
            msg += "\"}";
            res.set_content(msg, "application/json");
        }
    });

    // Resynthesize: takes WAV + external F0 (space-separated floats), returns WAV with new F0
    svr.Post("/resynthesize", [](const httplib::Request& req, httplib::Response& res) {
        try {
            if (!req.form.has_file("file")) {
                res.status = 400;
                res.set_content("{\"error\":\"Missing file\"}", "application/json");
                return;
            }

            const std::string& wav_data = req.form.get_file("file").content;
            WavFile wav = parse_wav(wav_data);
            if (wav.samples.empty()) throw std::runtime_error("Empty audio");

            // Parse provided F0 array (space-separated Hz values, 0 = unvoiced)
            std::vector<double> f0_ext;
            if (req.form.has_field("f0")) {
                std::istringstream iss(req.form.get_field("f0"));
                double val;
                while (iss >> val) f0_ext.push_back(std::max(0.0, val));
            }

            const int    x_len        = (int)wav.samples.size();
            const int    fs           = wav.sample_rate;
            const double frame_period = 5.0;

            double* x = wav.samples.data();

            // F0 estimation (needed for CheapTrick even if we override it)
            HarvestOption h_opt{};
            InitializeHarvestOption(&h_opt);
            h_opt.frame_period = frame_period;
            h_opt.f0_floor     = 50.0;
            h_opt.f0_ceil      = 1100.0;

            int f0_len = GetSamplesForHarvest(fs, x_len, frame_period);
            std::vector<double> temporal_pos(f0_len);
            std::vector<double> f0_orig(f0_len);

            Harvest(x, x_len, fs, &h_opt, temporal_pos.data(), f0_orig.data());
            StoneMask(x, x_len, fs, temporal_pos.data(), f0_orig.data(), f0_len, f0_orig.data());

            // Spectral envelope
            CheapTrickOption ct_opt{};
            InitializeCheapTrickOption(fs, &ct_opt);
            const int fft_size = ct_opt.fft_size;
            const int half     = fft_size / 2 + 1;

            double** spectrogram = new double*[f0_len];
            for (int i = 0; i < f0_len; i++) spectrogram[i] = new double[half];
            CheapTrick(x, x_len, fs, temporal_pos.data(), f0_orig.data(), f0_len, &ct_opt, spectrogram);

            // Aperiodicity
            D4COption d4c_opt{};
            InitializeD4COption(&d4c_opt);
            double** aperiodicity = new double*[f0_len];
            for (int i = 0; i < f0_len; i++) aperiodicity[i] = new double[half];
            D4C(x, x_len, fs, temporal_pos.data(), f0_orig.data(), f0_len,
                fft_size, &d4c_opt, aperiodicity);

            // Build final F0: interpolate provided array to WORLD frame count
            std::vector<double> f0_final(f0_len);
            if (f0_ext.size() >= 2) {
                for (int i = 0; i < f0_len; i++) {
                    double t   = (double)i * (f0_ext.size() - 1) / std::max(1, f0_len - 1);
                    int    lo  = std::max(0, std::min((int)f0_ext.size() - 2, (int)t));
                    double frac = t - lo;
                    f0_final[i] = f0_ext[lo] * (1.0 - frac) + f0_ext[lo + 1] * frac;
                    if (f0_final[i] < 0.0) f0_final[i] = 0.0;
                }
            } else if (f0_ext.size() == 1) {
                std::fill(f0_final.begin(), f0_final.end(), f0_ext[0]);
            } else {
                f0_final = f0_orig;
            }

            // Synthesis
            int y_len = (int)(f0_len * frame_period / 1000.0 * fs) + 1;
            std::vector<double> y(y_len, 0.0);
            Synthesis(f0_final.data(), f0_len, spectrogram, aperiodicity,
                      fft_size, frame_period, fs, y_len, y.data());

            for (int i = 0; i < f0_len; i++) {
                delete[] spectrogram[i];
                delete[] aperiodicity[i];
            }
            delete[] spectrogram;
            delete[] aperiodicity;

            auto out = encode_wav(y, fs);
            res.set_content(std::string(out.begin(), out.end()), "audio/wav");

        } catch (const std::exception& e) {
            res.status = 500;
            std::string msg = "{\"error\":\"";
            msg += e.what();
            msg += "\"}";
            res.set_content(msg, "application/json");
        }
    });

    printf("[world-service] Listening on :8002\n");
    fflush(stdout);

    svr.listen("0.0.0.0", 8002);
    return 0;
}
