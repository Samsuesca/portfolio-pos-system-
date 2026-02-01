# ============================================================================
# Script: Configurar SSH Server en Windows para acceso desde Mac
# Uso: Ejecutar como Administrador en PowerShell
# ============================================================================

# Verificar que se ejecuta como Administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configurando SSH Server en Windows   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Verificar/Instalar OpenSSH Server
Write-Host "[1/5] Verificando OpenSSH Server..." -ForegroundColor Green

# Primero verificar si ya esta instalado
$sshService = Get-Service -Name sshd -ErrorAction SilentlyContinue

if ($sshService) {
    Write-Host "      OpenSSH Server YA ESTA INSTALADO - saltando instalacion" -ForegroundColor Yellow
} else {
    Write-Host "      Instalando OpenSSH Server (esto puede tardar 2-5 minutos)..." -ForegroundColor Yellow
    Write-Host "      Por favor espera..." -ForegroundColor Gray

    try {
        # Metodo 1: Usar DISM (mas rapido)
        $dismResult = dism /Online /Add-Capability /CapabilityName:OpenSSH.Server~~~~0.0.1.0 /NoRestart 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "      OpenSSH Server instalado correctamente" -ForegroundColor Green
        } else {
            # Metodo 2: PowerShell (alternativa)
            Write-Host "      Intentando metodo alternativo..." -ForegroundColor Yellow
            Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 -ErrorAction Stop
            Write-Host "      OpenSSH Server instalado correctamente" -ForegroundColor Green
        }
    } catch {
        Write-Host "      ERROR instalando OpenSSH: $_" -ForegroundColor Red
        Write-Host "      Intentando continuar de todos modos..." -ForegroundColor Yellow
    }
}

# Paso 2: Iniciar el servicio sshd
Write-Host "[2/5] Configurando servicio SSH..." -ForegroundColor Green

try {
    # Verificar si el servicio existe ahora
    $sshService = Get-Service -Name sshd -ErrorAction SilentlyContinue

    if ($sshService) {
        Start-Service sshd -ErrorAction SilentlyContinue
        Set-Service -Name sshd -StartupType 'Automatic'
        Write-Host "      Servicio sshd iniciado y configurado" -ForegroundColor Green
    } else {
        Write-Host "      ADVERTENCIA: Servicio sshd no encontrado" -ForegroundColor Red
        Write-Host "      Es posible que necesites reiniciar Windows" -ForegroundColor Yellow
    }
} catch {
    Write-Host "      Error configurando servicio: $_" -ForegroundColor Red
}

# Paso 3: Configurar Firewall
Write-Host "[3/5] Configurando Firewall..." -ForegroundColor Green

try {
    $firewallRule = Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue

    if ($firewallRule) {
        Write-Host "      Regla de Firewall ya existe" -ForegroundColor Yellow
    } else {
        New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
        Write-Host "      Regla de Firewall creada para puerto 22" -ForegroundColor Green
    }
} catch {
    Write-Host "      Error configurando firewall: $_" -ForegroundColor Red
}

# Paso 4: Crear directorio .ssh y authorized_keys
Write-Host "[4/5] Configurando clave SSH de tu Mac..." -ForegroundColor Green

$sshDir = "$env:USERPROFILE\.ssh"
$authKeysFile = "$sshDir\authorized_keys"

try {
    # Crear directorio si no existe
    if (-not (Test-Path $sshDir)) {
        New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
        Write-Host "      Creado directorio .ssh" -ForegroundColor Green
    }

    # Tu clave publica SSH del Mac
    $macPublicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBhCgppZ3mtW69lcNAf1/EPstYMcel1iRb0Y/4fwVmDS vultr-commander"

    # Agregar clave
    if (Test-Path $authKeysFile) {
        $existingKeys = Get-Content $authKeysFile -ErrorAction SilentlyContinue
        if ($existingKeys -contains $macPublicKey) {
            Write-Host "      Clave SSH del Mac ya esta configurada" -ForegroundColor Yellow
        } else {
            Add-Content -Path $authKeysFile -Value $macPublicKey
            Write-Host "      Clave SSH del Mac agregada" -ForegroundColor Green
        }
    } else {
        Set-Content -Path $authKeysFile -Value $macPublicKey
        Write-Host "      Archivo authorized_keys creado" -ForegroundColor Green
    }
} catch {
    Write-Host "      Error configurando claves: $_" -ForegroundColor Red
}

# Paso 5: Configurar permisos
Write-Host "[5/5] Configurando permisos..." -ForegroundColor Green

try {
    $acl = Get-Acl $authKeysFile
    $acl.SetAccessRuleProtection($true, $false)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "Allow")
    $acl.SetAccessRule($rule)
    $adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators", "FullControl", "Allow")
    $acl.SetAccessRule($adminRule)
    Set-Acl $authKeysFile $acl
    Write-Host "      Permisos configurados" -ForegroundColor Green
} catch {
    Write-Host "      Error configurando permisos: $_" -ForegroundColor Yellow
}

# Reiniciar servicio
try {
    $sshService = Get-Service -Name sshd -ErrorAction SilentlyContinue
    if ($sshService -and $sshService.Status -eq 'Running') {
        Restart-Service sshd -ErrorAction SilentlyContinue
    }
} catch {}

# Mostrar informacion de conexion
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACION COMPLETADA!            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtener IP local
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and
    $_.IPAddress -notlike "169.*" -and
    $_.IPAddress -ne "127.0.0.1"
} | Select-Object -First 1).IPAddress

$windowsUser = $env:USERNAME

Write-Host "Para conectarte desde tu Mac, usa:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ssh $windowsUser@$localIP" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host ""
Write-Host "IP de este PC: $localIP" -ForegroundColor Cyan
Write-Host "Usuario Windows: $windowsUser" -ForegroundColor Cyan
Write-Host ""

# Verificar estado del servicio
$sshService = Get-Service -Name sshd -ErrorAction SilentlyContinue
if ($sshService) {
    Write-Host "Estado del servicio SSH: $($sshService.Status)" -ForegroundColor $(if ($sshService.Status -eq 'Running') { 'Green' } else { 'Red' })
} else {
    Write-Host "ADVERTENCIA: El servicio SSH no esta disponible" -ForegroundColor Red
    Write-Host "Puede que necesites REINICIAR WINDOWS y ejecutar el script de nuevo" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Presiona cualquier tecla para salir..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")