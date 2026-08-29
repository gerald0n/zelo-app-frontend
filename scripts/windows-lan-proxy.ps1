#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Encaminha portas do Windows → WSL para o Zelo na LAN.

.DESCRIPTION
  Expõe na rede Wi‑Fi:
    - 3000  (Next.js)
    - 54321 (Supabase API local)

  Uso (PowerShell Admin, na pasta do projeto ou com caminho completo):
    powershell -ExecutionPolicy Bypass -File scripts/windows-lan-proxy.ps1

  Remover:
    powershell -ExecutionPolicy Bypass -File scripts/windows-lan-proxy.ps1 -Remove
#>
param(
  [switch]$Remove,
  [int[]]$Ports = @(3000, 54321)
)

$ErrorActionPreference = 'Stop'

function Get-WslIpv4 {
  $raw = (wsl.exe -e sh -lc "hostname -I").Trim()
  if (-not $raw) { throw 'Não foi possível obter o IP do WSL (hostname -I).' }
  $ip = ($raw -split '\s+')[0]
  if ($ip -notmatch '^\d+\.\d+\.\d+\.\d+$') {
    throw "IP WSL inválido: $raw"
  }
  return $ip
}

function Get-WindowsLanIpv4 {
  $candidate = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -match '^(192\.168\.|10\.)' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
  return $candidate
}

$wslIp = Get-WslIpv4
$lanIp = Get-WindowsLanIpv4

Write-Host ""
Write-Host "Zelo LAN proxy" -ForegroundColor Cyan
Write-Host "  WSL IP:      $wslIp"
Write-Host "  Windows LAN: $(if ($lanIp) { $lanIp } else { '(não detectado)' })"
Write-Host ""

foreach ($port in $Ports) {
  netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null

  if (-not $Remove) {
    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp | Out-Null
    Write-Host "  + portproxy 0.0.0.0:$port → ${wslIp}:$port" -ForegroundColor Green
  } else {
    Write-Host "  - removido portproxy :$port" -ForegroundColor Yellow
  }

  $ruleName = "Zelo LAN TCP $port"
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($Remove) {
    if ($existing) {
      Remove-NetFirewallRule -DisplayName $ruleName
      Write-Host "  - firewall removido: $ruleName" -ForegroundColor Yellow
    }
  } elseif (-not $existing) {
    New-NetFirewallRule `
      -DisplayName $ruleName `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $port `
      -Profile Private |
      Out-Null
    Write-Host "  + firewall: $ruleName (Private)" -ForegroundColor Green
  } else {
    Write-Host "  · firewall já existe: $ruleName" -ForegroundColor DarkGray
  }
}

Write-Host ""
if ($Remove) {
  Write-Host "Proxy removido." -ForegroundColor Yellow
} elseif ($lanIp) {
  Write-Host "No celular (mesmo Wi‑Fi):  http://${lanIp}:3000" -ForegroundColor Cyan
  Write-Host "Depois, no WSL:             pnpm dev:lan" -ForegroundColor Cyan
} else {
  Write-Host "Proxy ok. Descubra o IP Wi‑Fi do Windows (ipconfig) e abra http://IP:3000" -ForegroundColor Cyan
}
Write-Host ""
