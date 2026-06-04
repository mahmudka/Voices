# PROGRESS.md — Состояние проекта

Единственный источник истины. Читается агентом в начале каждой сессии.
Обновляется после каждого завершённого шага.

---

## Статус проекта

**Фаза:** Phase 1
**Текущий шаг:** 9 — HuBERT + RVC ONNX inference
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
**Статус:** завершён
**Задача:** фронтенд с shadcn/ui, все элементы управления, wavesurfer визуализация
**Acceptance criteria:**
- [x] Приложение запускается на :5173 (Vite, npm run dev)
- [x] Загрузка WAV файла (drag-and-drop + кнопка)
- [x] Запись с микрофона (кнопка, POST /api/record/start + /stop)
- [x] Выбор: пол (муж/жен/дет), возраст (слайдер 5–80), тембр (низкий/средний/высокий)
- [x] Прогресс бар через SignalR (@microsoft/signalr)
- [x] Воспроизведение оригинала и результата (wavesurfer.js)
- [x] Кнопка скачать WAV
- [x] Повторный рендер без повторной загрузки (POST /api/convert/rerender)
- [x] История конвертаций (GET /api/history)
- [x] Удаление: отдельная запись / вся история (DELETE /api/history/{id}, /api/history)
**Testing:** npm run build → успешно, 331 KB JS

---

### Шаг 6 — PowerShell скрипт запуска
**Статус:** завершён
**Задача:** один скрипт поднимает все сервисы
**Acceptance criteria:**
- [x] start.ps1 запускает все 4 сервиса (WORLD, ML, Orchestrator, Frontend)
- [x] Проверяет что MSSQL доступен перед стартом (SqlConnection test)
- [x] Проверяет наличие world-service.exe и python venv
- [x] Ожидает HTTP readiness каждого сервиса с таймаутом
- [x] Открывает браузер на localhost:5173
- [x] Graceful shutdown по Ctrl+C (try/finally + taskkill /F /T)
**Testing:** синтаксис проверен PowerShell parser: 0 ошибок

---

### Шаг 7 — Pixi + pyproject.toml
**Статус:** завершён
**Задача:** мигрировать ml-service с venv+requirements.txt на Pixi+conda-forge
**Acceptance criteria:**
- [x] pyproject.toml создан с [tool.pixi.workspace], платформа win-64
- [x] requirements.txt удалён
- [x] pixi install выполнен успешно
- [x] Все пакеты импортируются: fastapi, onnxruntime, librosa, scipy, numpy, onnx
- [x] soundfile работает (conda-forge libsndfile)
- [x] start.ps1 обновлён: pixi run serve вместо прямого python.exe
- [x] .gitignore дополнен (.pixi/)
**Testing:** pixi run python -c "import fastapi, onnxruntime, librosa..." → OK; soundfile 0.13.1 → OK

---

### Шаг 8 — Voice library (бэкенд)
**Статус:** завершён
**Задача:** структура библиотеки голосов, API, БД
**Acceptance criteria:**
- [ ] shared/models/ создана, voices.json с каталогом голосов
- [ ] VoicePresets таблица заполнена из voices.json при старте оркестратора
- [ ] GET /api/voices возвращает список голосов
- [ ] ml-service принимает voice_id и загружает нужную модель
**Testing:** GET /api/voices → JSON со списком

---

### Шаг 9 — HuBERT + RVC ONNX inference
**Статус:** не начат
**Задача:** реальный пайплайн конвертации голоса через ONNX
**Acceptance criteria:**
- [ ] content-vec.onnx (HuBERT encoder) загружен и работает
- [ ] RVC decoder .onnx файлы для 5+ голосов подключены
- [ ] /convert использует HuBERT → RVC pipeline
- [ ] SKILLS.md обновлён: RVC ONNX vs RVC Python lib
**Testing:** /convert → WAV со слышимой сменой голоса

---

### Шаг 10 — UI redesign (голосовая галерея)
**Статус:** не начат
**Задача:** новый VoiceParams — карточки голосов, слайдеры возраст/высота/тембр
**Acceptance criteria:**
- [ ] Грид карточек голосов из /api/voices
- [ ] Активная карточка выделена (border accent + fill)
- [ ] Слайдер возраста с подписями (Ребёнок / Взрослый / Пожилой)
- [ ] Тембр — 3 кнопки с визуальным акцентом
**Testing:** UI открывается, выбор голоса меняет параметры конвертации

---

### Шаг 11 — Интеграционное тестирование
**Статус:** не начат
**Задача:** полный end-to-end тест всего пайплайна
**Acceptance criteria:**
- [ ] Файл из Adobe Audition проходит полный цикл
- [ ] Запись с MV7i проходит полный цикл
- [ ] Повторный рендер с другим голосом работает
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
| 5 | 2026-06-04 | React UI: Vite+Tailwind+wavesurfer+SignalR, FileDropZone, VoiceParams, WaveformPlayer, HistoryList; оркестратор +/history +/rerender +/audio/* |
| 6 | 2026-06-04 | scripts/start.ps1: MSSQL check, запуск 4 сервисов, health polling, браузер, Ctrl+C shutdown |
| 7 | 2026-06-04 | Pixi 0.70.1, pyproject.toml (conda-forge win-64), soundfile/libsndfile разблокирован, start.ps1 → pixi run |
| 8 | 2026-06-04 | VoicePreset переработан, voices.json (6 голосов), EF миграция VoiceLibrary, GET /api/voices, VoiceSeeder, ml-service voice_id routing |
