# PROGRESS.md — Состояние проекта

Единственный источник истины. Читается агентом в начале каждой сессии.
Обновляется после каждого завершённого шага.

---

## Статус проекта

**Фаза:** Phase 1
**Текущий шаг:** 5 — React UI
**Последнее обновление:** 2026-06-04

---

## Принятые решения (финальные)

- UI: React + Vite + shadcn/ui + Tailwind CSS + wavesurfer.js
- Оркестратор: ASP.NET Core MVC, C#, .NET 8, SignalR, NAudio
- ML сервис: Python 3.11+, FastAPI, librosa, ONNX Runtime
- Синтез: C++ + WORLD вокодер + cpp-httplib
- База данных: MSSQL локальный, Windows Authentication, EF Core 8
- Запуск: PowerShell скрипт (один клик)
- Стиль UI: shadcn/ui (Claude Artifacts стиль)
- Хранение файлов: shared/audio/input/ и shared/audio/output/
- Удаление: файл + запись БД всегда вместе
- Повторный рендер: без повторной загрузки файла, в рамках сессии
- Перевод речи: Phase 2, не сейчас

---

## Шаги Phase 1

### Шаг 0 — Инициализация репозитория
**Статус:** завершён
**Задача:** создать структуру папок, все .md файлы, .gitignore, первый коммит
**Acceptance criteria:**
- [x] Структура папок создана
- [x] README.md, CLAUDE.md, AGENTS.md, SKILLS.md, PROGRESS.md в репо
- [x] .gitignore настроен (node_modules, bin, obj, __pycache__, *.wav в shared/)
- [x] Первый коммит и push в main
**Testing:** репозиторий открывается на GitHub, все файлы видны

---

### Шаг 1 — База данных и модели
**Статус:** завершён
**Задача:** создать БД VoiceConverter, таблицы, EF Core миграции
**Acceptance criteria:**
- [x] БД VoiceConverter создана в MSSQL
- [x] Таблица Conversions (Id, SessionId, InputFile, InputPath, OutputFile, OutputPath, VoiceType, Age, Timbre, CreatedAt)
- [x] Таблица VoicePresets (Id, Name, VoiceType, Age, Timbre)
- [x] EF Core миграция применена
- [x] Подключение через Windows Authentication работает
**Testing:** БД создана, таблицы проверены через sqlcmd — 3 таблицы (Conversions, VoicePresets, __EFMigrationsHistory)

---

### Шаг 2 — ASP.NET Core оркестратор
**Статус:** завершён
**Задача:** базовый MVC проект, SignalR хаб, NAudio захват, HTTP клиенты к сервисам
**Acceptance criteria:**
- [x] Проект запускается на :5000
- [x] SignalR хаб /convertHub работает (ConvertHub с IConvertClient, /convertHub endpoint)
- [x] NAudio захватывает аудио с Shure MV7i (AudioCaptureService, WASAPI, поиск по "MV7i")
- [x] Эндпоинт POST /api/convert принимает файл и параметры
- [x] HttpClient настроен для вызовов к :8001 (MlService) и :8002 (WorldService)
- [x] Файлы сохраняются в shared/audio/input/
**Testing:** POST /api/convert вернул 200, записи в Conversions созданы, WAV файлы в shared/audio/input/ — подтверждено

---

### Шаг 3 — Python ML сервис
**Статус:** завершён
**Задача:** FastAPI сервис, librosa анализ, ONNX Runtime конвертация
**Acceptance criteria:**
- [x] Сервис запускается на :8001
- [x] POST /analyze — F0 через scipy autocorrelation (librosa.pyin недоступен — numba нет на ARM64)
- [x] POST /convert — конвертация тембра через ONNX (placeholder модель, identity transform)
- [x] ONNX модель загружается (CPUExecutionProvider; DML требует onnxruntime-directml)
- [x] Возвращает обработанный WAV
**Testing:** /analyze → 440.4 Hz на синусоиде 440 Hz ✓; /convert → WAV 96 KB ✓

---

### Шаг 4 — C++ WORLD сервис
**Статус:** завершён
**Задача:** HTTP сервис на cpp-httplib, WORLD вокодер, F0 перенос и синтез
**Acceptance criteria:**
- [x] Сервис собирается под ARM64 Windows (MSVC 14.44.35207 из VS 2022 Build Tools)
- [x] Запускается на :8002
- [x] POST /synthesize — принимает WAV + параметры (voice_type, age, timbre)
- [x] F0 из оригинала переносится на синтезированный голос (Harvest + StoneMask)
- [x] Форманты модифицируются по таблице из SKILLS.md (shift_formants + get_params)
- [x] Возвращает итоговый WAV
**Testing:** curl POST /synthesize → 200 OK, WAV 96 KB ✓

---

### Шаг 5 — React UI
**Статус:** не начат
**Задача:** фронтенд с shadcn/ui, все элементы управления, wavesurfer визуализация
**Acceptance criteria:**
- [ ] Приложение запускается на :5173
- [ ] Загрузка WAV файла (drag-and-drop + кнопка)
- [ ] Запись с микрофона
- [ ] Выбор: пол, возраст (слайдер 5–80), тембр (низкий/средний/высокий)
- [ ] Прогресс бар через SignalR
- [ ] Воспроизведение оригинала и результата (wavesurfer.js)
- [ ] Кнопка скачать WAV
- [ ] Повторный рендер без повторной загрузки файла
- [ ] История конвертаций со списком
- [ ] Удаление: отдельный файл / вся сессия / вся история
**Testing:** полный цикл загрузка → рендер → прослушивание → скачивание

---

### Шаг 6 — PowerShell скрипт запуска
**Статус:** не начат
**Задача:** один скрипт поднимает все сервисы
**Acceptance criteria:**
- [ ] start.ps1 запускает все 4 сервиса
- [ ] Проверяет что MSSQL доступен перед стартом
- [ ] Открывает браузер на localhost:5173
- [ ] Graceful shutdown всех процессов по Ctrl+C
**Testing:** холодный запуск, всё поднимается без ручных действий

---

### Шаг 7 — Интеграционное тестирование
**Статус:** не начат
**Задача:** полный end-to-end тест всего пайплайна
**Acceptance criteria:**
- [ ] Файл из Adobe Audition проходит полный цикл
- [ ] Запись с MV7i проходит полный цикл
- [ ] Повторный рендер с другими параметрами работает
- [ ] Удаление файлов и записей из БД работает корректно
- [ ] Прогресс бар отображается корректно
**Testing:** тест всех сценариев из UI

---

## Открытые вопросы

- Какая конкретно ONNX модель для voice conversion (уточнить на шаге 3)
- Совместимость cpp-httplib с ARM64 Windows MSVC (проверить на шаге 4)

---

## Найденные проблемы

пусто

---

## Лог изменений

| Шаг | Дата | Описание |
|---|---|---|
| 0 | старт | Инициализация .md файлов |
| 0 | 2026-06-04 | Структура папок, .gitignore обновлён, scripts/start.ps1 заглушка |
| 1 | 2026-06-04 | ASP.NET Core MVC проект, EF Core 8, модели Conversion/VoicePreset, миграция применена |
| 2 | 2026-06-04 | SignalR ConvertHub, AudioCaptureService (WASAPI/NAudio), ConversionService, POST /api/convert, HttpClients :8001/:8002 |
| 3 | 2026-06-04 | FastAPI :8001, /analyze (scipy autocorr F0), /convert (ONNX placeholder), /health; ARM64 ограничения в SKILLS.md |
| 4 | 2026-06-04 | C++ WORLD сервис :8002, MSVC 14.44.35207 (VS 2022 BuildTools), Harvest+StoneMask+CheapTrick+D4C+Synthesis, /health + /synthesize |
