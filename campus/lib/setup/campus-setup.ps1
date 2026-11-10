# Instalador del campus de AI-Centric Management (IAE · Universidad Austral), para Windows.
#
#   irm __CAMPUS_URL__/setup.ps1 | iex
#
# Qué hace, en orden:
#   1. Instala Claude Code si no está (instalador oficial de claude.ai).
#   2. Te pide confirmar esta compu en el campus (se abre el navegador).
#   3. Conecta Claude Code al campus (claude mcp add, alcance de usuario).
#   4. Mira qué herramientas del stack tenés (git, gh, node, vercel, supabase)
#      y se lo cuenta al campus: eso marca tu entrega B1.
# No instala nada más ni manda contraseñas. El token del campus queda solo en
# la configuración de Claude Code.
#
# Variables opcionales: $env:CAMPUS_NO_BROWSER = '1', $env:CAMPUS_URL (otro campus, para pruebas).

& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $Campus = if ($env:CAMPUS_URL) { $env:CAMPUS_URL } else { '__CAMPUS_URL__' }
  $Campus = $Campus.TrimEnd('/')

  function Paso($t) { Write-Host ''; Write-Host "> $t" -ForegroundColor White }
  function Ok($t) { Write-Host "  OK $t" -ForegroundColor Green }
  function Ojo($t) { Write-Host "  ! $t" -ForegroundColor Yellow }
  function Fallo($t) { Write-Host ''; Write-Host "X $t" -ForegroundColor Red; throw 'campus-setup' }
  function Version($cmd, [string[]]$cmdArgs = @('--version')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { return '' }
    try { $out = & $cmd @cmdArgs 2>$null | Select-Object -First 1; return "$out".Trim() } catch { return '' }
  }

  try {
    Write-Host 'Campus · AI-Centric Management' -ForegroundColor White
    Write-Host 'Vamos a dejar Claude Code conectado al campus y tu entorno verificado (B1).'

    $Os = try { (Get-CimInstance Win32_OperatingSystem).Caption + ' ' + [Environment]::OSVersion.Version } catch { [Environment]::OSVersion.VersionString }
    $HostName = $env:COMPUTERNAME

    # --- Claude Code
    Paso 'Claude Code'
    $localBin = Join-Path $env:USERPROFILE '.local\bin'
    if (-not (Get-Command claude -ErrorAction SilentlyContinue) -and $env:Path -notlike "*$localBin*") { $env:Path = "$localBin;$env:Path" }
    if (Get-Command claude -ErrorAction SilentlyContinue) {
      Ok "ya está instalado ($(Version claude))"
    } else {
      Ojo 'no está instalado: lo instalo con el instalador oficial de claude.ai'
      try { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression } catch { Fallo "No se pudo instalar Claude Code: $($_.Exception.Message). Copiá este error: sirve como evidencia para B1." }
      if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Fallo "Se instaló, pero no encuentro claude. Abrí otra ventana de PowerShell y corré de nuevo: irm $Campus/setup.ps1 | iex" }
      Ok "instalado ($(Version claude))"
    }
    $ClaudeV = Version claude

    # --- Emparejar
    Paso 'Conectar esta compu con tu cuenta del campus'
    try {
      $r1 = Invoke-RestMethod -Method Post -Uri "$Campus/api/setup/start" -ContentType 'application/json' -Body (@{ hostname = $HostName; os = $Os } | ConvertTo-Json)
    } catch { Fallo "No pude hablar con $Campus. ¿Tenés internet?" }
    if (-not $r1.deviceCode) { Fallo "El campus no contestó bien: $($r1.error)" }
    Write-Host ''
    Write-Host "  Tu código: $($r1.userCode)" -ForegroundColor White
    Write-Host "  Confirmalo en: $($r1.verifyUrl)"
    if (-not $env:CAMPUS_NO_BROWSER) { try { Start-Process $r1.verifyUrl; Write-Host '  (te abrí el navegador; si no ves nada, copiá el link)' } catch {} }
    Write-Host -NoNewline '  Esperando que confirmes'

    $interval = if ($r1.interval) { [int]$r1.interval } else { 3 }
    $deadline = (Get-Date).AddSeconds($(if ($r1.expiresIn) { [int]$r1.expiresIn } else { 600 }))
    $r2 = $null
    while ((Get-Date) -lt $deadline) {
      Start-Sleep -Seconds $interval
      try {
        $p = Invoke-RestMethod -Method Post -Uri "$Campus/api/setup/poll" -ContentType 'application/json' -Body (@{ deviceCode = $r1.deviceCode } | ConvertTo-Json)
      } catch { Write-Host -NoNewline '.'; continue }
      if ($p.status -eq 'ok') { $r2 = $p; break }
      if ($p.status -eq 'rechazado') { Write-Host ''; Fallo 'Rechazaste la conexión en el campus. Si fue un error, corré el comando de nuevo.' }
      if ($p.status -eq 'vencido' -or $p.status -eq 'desconocido') { Write-Host ''; Fallo 'El código venció. Corré el comando de nuevo.' }
      Write-Host -NoNewline '.'
    }
    Write-Host ''
    if (-not $r2) { Fallo 'Pasaron 10 minutos sin confirmar. Corré el comando de nuevo.' }
    $McpUrl = if ($r2.mcpUrl) { $r2.mcpUrl } else { "$Campus/api/mcp" }
    Ok "confirmado: $($r2.name)"

    # --- Conectar Claude Code
    Paso 'Conectar Claude Code al campus'
    & claude mcp remove campus -s user *> $null
    & claude mcp remove campus -s local *> $null
    & claude mcp add --scope user --transport http campus $McpUrl --header "Authorization: Bearer $($r2.token)" *> $null
    if ($LASTEXITCODE -ne 0) { Fallo 'claude mcp add falló. Probá a mano desde el campus (Mi organización → Hacerlo a mano).' }
    Ok 'Claude Code tiene el servidor «campus» (para todos tus proyectos)'

    # --- Stack
    Paso 'Tu stack'
    $GitV = Version git
    $NodeV = Version node
    $GhV = Version gh
    $GhUser = ''
    if ($GhV) { $GhUser = Version gh @('api', 'user', '-q', '.login') }
    if (-not $GhUser -and $GitV) { $GhUser = Version git @('config', '--global', 'user.name') }
    $env:CI = '1'
    $VercelV = Version vercel
    $VercelUser = if ($VercelV) { Version vercel @('whoami') } else { '' }
    Remove-Item Env:CI -ErrorAction SilentlyContinue
    $SupaV = Version supabase

    $falta = @()
    $items = @(
      @('Claude Code', $ClaudeV, 'irm https://claude.ai/install.ps1 | iex'),
      @('git', $GitV, 'winget install Git.Git'),
      @('Node.js', $NodeV, 'winget install OpenJS.NodeJS.LTS'),
      @('GitHub CLI', $(if ($GhV) { "$GhV$(if ($GhUser) { " · $GhUser" })" } else { '' }), 'winget install GitHub.cli; gh auth login'),
      @('Vercel CLI', $(if ($VercelV) { "$VercelV$(if ($VercelUser) { " · $VercelUser" })" } else { '' }), 'npm i -g vercel; vercel login'),
      @('Supabase CLI', $SupaV, 'scoop install supabase (o ver supabase.com/docs/guides/cli)')
    )
    foreach ($it in $items) {
      if ($it[1]) { Ok "$($it[0]): $($it[1])" } else { Ojo "$($it[0]): no está · $($it[2])"; $falta += $it[0] }
    }

    # --- Saludo al campus (marca B1)
    if ($r2.role -eq 'alumno') {
      Paso 'Saludo al campus'
      $arguments = @{ client = 'claude-code'; clientVersion = $ClaudeV; os = $Os; message = "Instalador del campus (Windows). git: $(if ($GitV) { $GitV } else { 'no' }); node: $(if ($NodeV) { $NodeV } else { 'no' }); gh: $(if ($GhV) { $GhV } else { 'no' }); vercel: $(if ($VercelV) { $VercelV } else { 'no' })." }
      if ($GhUser) { $arguments.githubUser = $GhUser }
      if ($VercelUser) { $arguments.vercelUser = $VercelUser }
      if ($SupaV) { $arguments.supabase = "supabase $SupaV" }
      $body = @{ jsonrpc = '2.0'; id = 1; method = 'tools/call'; params = @{ name = 'hola_campus'; arguments = $arguments } } | ConvertTo-Json -Depth 6
      try {
        $r3 = Invoke-RestMethod -Method Post -Uri $McpUrl -ContentType 'application/json; charset=utf-8' -Headers @{ Authorization = "Bearer $($r2.token)"; Accept = 'application/json' } -Body ([Text.Encoding]::UTF8.GetBytes($body))
        if ($r3.result -and -not $r3.result.isError) {
          $sc = $r3.result.structuredContent
          Ok $(if ($sc.saludo) { $sc.saludo } else { 'El campus te recibió.' })
          if ("$($sc.entregaB1.estado)" -like 'entregada*') { Ok 'Entrega B1 marcada con esta verificación' } else { Ojo 'La verificación quedó guardada, pero B1 no se marcó (mirá el campus).' }
        } else { throw 'sin resultado' }
      } catch {
        Ojo 'Claude Code quedó conectado, pero el saludo no llegó. Abrí claude y pedile «decile hola al campus».'
      }
    }
    $r2 = $null

    Write-Host ''
    if ($falta.Count -eq 0) { Write-Host 'Listo. Tenés todo el stack.' -ForegroundColor White }
    else { Write-Host "Listo. Falta: $($falta -join ', '). Instalalo con los comandos de arriba y volvé a correr este instalador." -ForegroundColor White }
    Write-Host 'Abrí claude y escribí /mcp para verlo: «campus» tiene que figurar conectado.'
    Write-Host "En el campus: $Campus/campus/entregas/aicm-b1-entorno"
  } catch {
    if ("$_" -ne 'campus-setup') { Write-Host ''; Write-Host "X $($_.Exception.Message)" -ForegroundColor Red }
  }
}
