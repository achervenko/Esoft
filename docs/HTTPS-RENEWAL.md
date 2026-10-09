# Автопродление HTTPS на Windows через REG.RU

Подготовленные hooks находятся в `deploy/windows/certificates`. Их установка и расписание выполняются на сервере; текущий тестовый HTTPS на ПК продолжает работать с вручную выпущенным сертификатом. API-реквизиты и задача продления сейчас не настроены.

## Подготовка

1. Администратор устанавливает проверенную версию Win-ACME с DNS script и PEM store (шаблоны рассчитаны на CLI 2.2.9), Caddy и отдельную учётную запись задачи. Не устанавливайте второй параллельный ACME scheduler для того же сертификата.
2. В REG.RU включите доступ к REG.API для аккаунта, управляющего зоной, и настройте отдельный API-пароль и разрешённый исходящий IP согласно условиям своего аккаунта. Возможность API необходимо подтвердить в панели/поддержке; наличие домена само по себе не гарантирует доступ. При динамическом исходящем IP продление может перестать работать. Скрипты обращаются к `api.reg.ru` по HTTPS; входящие интернет-порты сервера не требуются.
3. Скопируйте hooks в `C:\Esoft\services\certificates`. Шаблон `renewal-settings.example.json` скопируйте туда же под именем `renewal-settings.json` и адаптируйте `AllowedZone`, `CaddyPath` и `CaddyfilePath` под сервер. Значения шаблона служат примером, а не готовой production-конфигурацией. Локальный `renewal-settings.json` не коммитьте: в Git хранится только example, локальный конфиг и `RegRu.credential.xml` исключены через `.gitignore`. `AllowedZone` ограничивает hooks конкретным доменом и узлом `_acme-challenge`; wildcard и другие зоны этим шаблоном не обслуживаются.
4. Ограничьте NTFS ACL каталога администраторами и учётной записью задачи. Под этой же учётной записью, **на самом сервере**, выполните:

```powershell
Get-Credential -Message 'REG.RU login and separate API password' |
  Export-Clixml -LiteralPath 'C:\Esoft\services\certificates\RegRu.credential.xml'
```

Windows DPAPI защищает пароль для текущего пользователя и компьютера. Копирование этого XML с тестового ПК не переносит рабочий секрет: на сервере его создают заново. Задача запускается под той же учётной записью с загруженным профилем и доступом к сертификатам/ACME state. Не передавайте пароль в командной строке и не включайте HTTP debug/transcript с телами запросов.

## DNS и ожидание публикации

Рядом с `wacs.exe` создайте `settings.json` на основе `settings_default.json` выбранной версии. Сохраните остальные настройки и задайте:

```json
"Validation": {
  "PreValidateDns": true,
  "PreValidateDnsRetryCount": 180,
  "PreValidateDnsRetryInterval": 30,
  "DnsServers": ["ns1.reg.ru", "ns2.reg.ru"]
}
```

Это позволяет ждать публикацию около 90 минут. Не отключайте DNS prevalidation: бесплатные серверы REG.RU могут публиковать изменение больше часа. Лимит выполнения всей задачи должен учитывать это ожидание. Проверьте, что VPN и firewall не перехватывают DNS и допускают исходящие запросы к указанным серверам.

Hook читает существующие TXT-записи, добавляет токен только при его отсутствии и удаляет только точное совпадение имени, типа и значения. Ошибки API, в том числе ошибка конкретной зоны при успешном общем ответе, возвращают ненулевой код. Посторонние TXT/A/MX-записи не меняются. Если hook завершился аварийно, может остаться TXT-токен; оператор удаляет только этот токен после проверки.

## Регистрация автоматической выдачи

PEM store записывает файлы с именами домена. В рабочем Caddyfile используйте:

```caddyfile
tls C:/Esoft/certs/insolution-esoft.ru-chain.pem C:/Esoft/certs/insolution-esoft.ru-key.pem
```

Учётной записи задачи нужны запись PEM, чтение hooks/секретов и доступ к локальному admin endpoint Caddy. Proxy получает чтение PEM, frontend и Caddyfile, запись своего журнала и возможность слушать 443. Backend-реквизиты для продления не нужны.

Под учётной записью задачи выполните (пути адаптировать; email заменить своим):

```powershell
C:\Esoft\tools\win-acme\wacs.exe --source manual --host insolution-esoft.ru `
  --friendlyname Esoft-HTTPS --emailaddress ADMIN_EMAIL --accepttos `
  --validationmode dns-01 --validation script `
  --dnsscript C:\Esoft\services\certificates\RegRu-Dns.ps1 `
  --dnscreatescriptarguments "create '{Identifier}' '{RecordName}' '{Token}'" `
  --dnsdeletescriptarguments "delete '{Identifier}' '{RecordName}' '{Token}'" `
  --dnsscriptparallelism 0 `
  --store pemfiles --pemfilespath C:\Esoft\certs `
  --installation script --script C:\Esoft\services\certificates\Reload-EsoftProxy.ps1 `
  --notaskscheduler
```

`--source manual` здесь означает явно заданный домен; DNS-проверка выполняется автоматическим script hook. Caddyfile проверяется до reload. `reload --force` заставляет перечитать новые PEM при неизменившемся тексте конфигурации. Запущенный backend не останавливается. Если validate/reload не удался, hook возвращает ошибку, а работающий proxy сохраняет прежнюю конфигурацию; новый сертификат на диске не означает, что он уже используется.

Сначала проверьте API и выдачу на Let's Encrypt staging с отдельными каталогами ACME/PEM и **без installation hook** (`--test --installation none`). Staging-сертификат не доверенный: не записывайте его поверх рабочего и не подключайте к текущему proxy. После staging выполните production-регистрацию. Избегайте повторной принудительной выдачи в production из-за лимитов центра сертификации. Если ранее была manual DNS renewal, исключите её из расписания; не отменяйте и не отзывайте действующий сертификат.

## Ежедневная задача и наблюдение

Создайте одну ежедневную задачу Task Scheduler, например на 03:00, с запретом параллельных экземпляров. Программа — абсолютный путь `wacs.exe`; аргументы: `--renew --friendlyname Esoft-HTTPS`; рабочий каталог — каталог Win-ACME. Запускайте при отсутствии входа пользователя под той же учётной записью. Win-ACME проверяет необходимость продления и не выпускает новый сертификат ежедневно. Не используйте `--force` в ежедневной задаче.

Сохраняйте ACME logs с ограниченными правами, контролируйте exit code/ошибки hook и срок **сертификата, фактически отдаваемого proxy**, с предупреждением минимум за 21 день. Не полагайтесь только на успешный Task Scheduler status. При ошибке reload после успешной выдачи исправьте причину и выполните `Reload-EsoftProxy.ps1` отдельно: повторная выдача не нужна. Периодически проверяйте запуск задачи под её реальной учётной записью; изменение пользователя, пароля, ACL, IP или перенос сервера требует повторной проверки DPAPI/API.

Переносятся hooks, JSON с адаптированными путями, ACME account/renewal state и PEM через защищённый канал. DPAPI credential создаётся заново, задача регистрируется заново. Секреты, закрытые ключи и заполненные runtime-файлы остаются вне Git.

## Проверка результата

```powershell
Invoke-RestMethod 'https://insolution-esoft.ru/api/health'
```

Endpoint должен вернуть HTTP 200 и JSON с `status: "ok"` и состоянием зависимостей в `dependencies`; браузер должен доверять HTTPS. Backend публикует health по `/api/health`. Matcher Caddy пересылает пути без переписывания: наличие `/health` в matcher само по себе не создаёт отдельного endpoint `/health` на backend. Дополнительно проверьте новый срок/issuer сертификата через браузер, наличие успешного reload в журнале и удаление только использованного TXT. Не отключайте проверку TLS ради успешного теста.

Источники: [REG.API](https://www.reg.ru/support/help/api2), [Win-ACME DNS script](https://www.win-acme.com/reference/plugins/validation/dns/script), [installation script](https://www.win-acme.com/reference/plugins/installation/script), [settings](https://www.win-acme.com/reference/settings), [формат REG.RU запросов в поддерживаемом Posh-ACME plugin](https://github.com/rmbolger/Posh-ACME/blob/main/Posh-ACME/Plugins/Regru.ps1).
