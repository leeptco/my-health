' Запускает сервер без окна консоли. Используется задачей автозапуска (см. install-autostart.ps1).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root
sh.Run "cmd /c ""cd /d """ & root & """ && node --disable-warning=ExperimentalWarning server.js >> data\server.log 2>&1""", 0, False
