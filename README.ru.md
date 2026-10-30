# M6 Lite Control (RU)

Настольное приложение на Electron для управления клавиатурой MMStudio M6 Lite+ (Hall Effect) через USB HID. Английская версия этого файла: [README.md](README.md).

Существует также веб-версия, работающая в браузере через WebHID без установки: репозиторий [M6-Lite-Control-Web](https://github.com/fxckthiswrld/M6-Lite-Control-Web).

## Возможности

- Настройка Hall Effect: точка срабатывания и Rapid Trigger для каждой клавиши.
- Мультиредактирование HE для группы клавиш, «Apply to all», экспорт/импорт профилей.
- Сохранение RT завершает CRC-обмен с клавиатурой перед чтением; проверка отключением USB и протокол — в [RT persistence](protocol/RT_PERSISTENCE_FIX.md).
- Калибровка: чтение, полная калибровка и по выбранным клавишам.
- Переназначение клавиш с полноэкранной раскладкой и выбором иконок/подписей.
- Media, FN/слой, HotKey, DKS и Snap Tap/SOCD программирование.
- Подсветка: Back Light и Under Light; **Single Light** — RGB и яркость для отдельных клавиш и групп (выделение кликами по макету, кнопка Apply, слой включается автоматически).
- EQ-режим подсветки с работой через трей.
- Режимы BeastMode, EyeMode, DevMode и FPS Enhance.
- Highlight, авто-калибровка прошивки, автоотключение подсветки (1–30 минут) и Saturation R/G/B (64–255) — каждая настройка с отдельной кнопкой Apply.
- Метки времени чтения калибровки, счётчики изменений диапазонов и ошибки опроса. Живые значения до Finish пока недоступны; см. [проверку на железе](protocol/CALIBRATION_READOUT.md).
- Тестер клавиш и команда сохранения памяти устройства.

## Сборка

Требования: Windows x64, Node.js 22+ и npm.

```powershell
cd electron
npm ci
npm test
npm run build:win
```

Портативная сборка появится в `dist/M6-Lite-Control-<версия>-win32-x64`.

Для установщика установите NSIS и выполните:

```powershell
$version = node -p "require('./package.json').version"
& "$env:ProgramFiles(x86)\NSIS\makensis.exe" "/DAPP_VERSION=$version" "..\installer\M6-Lite-Control.nsi"
```

## Автоматические релизы

Workflow `.github/workflows/windows-release.yml` запускает тесты, собирает портативную версию, создаёт NSIS-установщик и публикует GitHub Release при пуше тега `v*`:

```powershell
git tag v0.10.80
git push origin v0.10.80
```

Репозиторий приватный: он содержит детали протокола устройства и результаты реверс-инжиниринга.

## Версия для браузера

Веб-версия с тем же протоколом живёт в отдельном репозитории — [M6-Lite-Control-Web](https://github.com/fxckthiswrld/M6-Lite-Control-Web) (WebHID, Chrome/Edge, запуск через `npm start`).

## Безопасность устройства

Держите клавиатуру подключённой напрямую по USB во время применения настроек. Приложение создаёт локальные резервные копии перед записью конфигурации. После смены режима производительности дождитесь переподключения клавиатуры и нажмите **Refresh** в Device Settings.
