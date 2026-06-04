# SKILLS.md — Технические ограничения и проверенные решения

Этот файл содержит зафиксированные технические решения и ограничения платформы. Обновляется по мере разработки.

---

## Платформа

| Параметр | Значение |
|---|---|
| ОС | Windows 11, ARM64 |
| CPU | Qualcomm Snapdragon X X1-26-100 |
| RAM | 32GB DDR5 |
| GPU | Qualcomm Adreno (нет CUDA, есть DirectML) |
| Микрофон | Shure MV7i, USB, 24bit/48kHz |

---

## Критические ограничения ARM64 Windows

- **PyTorch:** не работает нативно на ARM64 Windows через pip. Использовать ONNX Runtime вместо PyTorch.
- **CUDA:** недоступна. GPU доступен через DirectML (ONNX Runtime DmlExecutionProvider).
- **RVC:** не поддерживается напрямую без патчинга под DirectML. Не использовать.
- **Python wheels:** проверять наличие ARM64 wheel перед добавлением зависимости.

---

## Верифицированные библиотеки

### Python
| Библиотека | Версия | ARM64 Windows | Назначение |
|---|---|---|---|
| onnxruntime | 1.17+ | да (официально) | ML inference |
| librosa | 0.10+ | да | аудио анализ, F0 |
| sounddevice | 0.4+ | да | захват микрофона |
| noisereduce | 3.0+ | да | шумоподавление |
| fastapi | 0.110+ | да | HTTP сервис |
| uvicorn | 0.29+ | да | ASGI сервер |

### C#
| Пакет | Версия | Назначение |
|---|---|---|
| Microsoft.ML.OnnxRuntime | 1.17+ | ML inference (если нужен в C#) |
| NAudio | 2.2+ | захват WASAPI, работа с WAV |
| Microsoft.AspNetCore | .NET 8 | MVC, SignalR |
| Microsoft.EntityFrameworkCore.SqlServer | 8.0+ | MSSQL ORM |

### JavaScript
| Пакет | Версия | Назначение |
|---|---|---|
| react | 18+ | UI фреймворк |
| vite | 5+ | сборщик |
| wavesurfer.js | 7+ | визуализация аудио волны |
| shadcn/ui | актуальная | UI компоненты |
| tailwindcss | 3+ | стили |

### C++
| Библиотека | Назначение |
|---|---|
| WORLD вокодер | F0 извлечение, форманты, синтез |
| cpp-httplib | HTTP сервер для C++ сервиса |
| CMake 3.20+ | сборка |

---

## ONNX Runtime на ARM64 Windows

```python
# Правильная инициализация с DirectML fallback
import onnxruntime as ort

providers = ['DmlExecutionProvider', 'CPUExecutionProvider']
session = ort.InferenceSession("model.onnx", providers=providers)
```

DmlExecutionProvider использует Adreno GPU через DirectX 12.
CPUExecutionProvider — fallback если DML недоступен.

---

## Аудио параметры

| Параметр | Значение |
|---|---|
| Sample rate | 48000 Hz |
| Bit depth | 24 bit |
| Каналы | Mono (1) |
| Формат входа | WAV |
| Формат выхода | WAV |
| Нормализация | -3 dBFS пик |

---

## WORLD вокодер — параметры голоса

| Параметр | Мужской взрослый | Женский взрослый | Детский |
|---|---|---|---|
| F0 множитель | 0.85 | 1.7 | 2.2–2.8 |
| Формантный сдвиг | 0.9 | 1.15 | 1.4–1.6 |
| Апериодичность | низкая | средняя | низкая |

Тембр (низкий/средний/высокий) модифицирует формантный сдвиг дополнительно поверх базовых значений.

---

## База данных

- MSSQL Server, локальный, Windows Authentication
- Connection string: `Server=localhost;Database=VoiceConverter;Trusted_Connection=True;`
- ORM: Entity Framework Core 8

---

## Производительность (оценка на Snapdragon X, CPU)

| Длина записи | Ожидаемое время рендера |
|---|---|
| 10 сек | ~8–15 сек |
| 30 сек | ~20–45 сек |
| 60 сек | ~40–90 сек |

С DirectML (Adreno) — ориентировочно в 2 раза быстрее для ML этапа.

---

## Неизвестно / требует проверки

- Точная скорость ONNX DmlExecutionProvider на Adreno для voice conversion моделей
- Какие конкретно ONNX модели для voice conversion будут использоваться (уточнить на шаге ML сервиса)
- Совместимость cpp-httplib с ARM64 Windows MSVC — проверить при сборке

---

## История изменений

| Дата | Изменение |
|---|---|
| Старт | Инициализация файла |
