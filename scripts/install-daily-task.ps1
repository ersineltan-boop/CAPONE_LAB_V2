#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RunScript = Join-Path $ProjectRoot "scripts\run-capone-daily.cmd"
$TaskName = "CAPONE_LAB_DAILY_REFRESH"

if (-not (Test-Path $RunScript)) {
  throw "Daily runner not found: $RunScript"
}

$Action = New-ScheduledTaskAction `
  -Execute $RunScript `
  -WorkingDirectory $ProjectRoot

$Trigger = New-ScheduledTaskTrigger -Daily -At "07:00"

$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4)

$Principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

$Task = Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "CAPONE LAB V2 daily multibrand collect, analyze, snapshot, and compare." `
  -Force

Write-Host ""
Write-Host "=== CAPONE LAB Daily Task Installed ==="
Write-Host "Task name : $TaskName"
Write-Host "Schedule  : Daily at 07:00 (missed runs start when PC becomes available)"
Write-Host "Runner    : $RunScript"
Write-Host "Logs      : $ProjectRoot\logs\"
Write-Host ""
Write-Host "Verify with:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Format-List TaskName, State"
Write-Host "  Get-ScheduledTaskInfo -TaskName '$TaskName'"
Write-Host ""
