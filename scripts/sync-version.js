#!/usr/bin/env node
/**
 * sync-version.js - Sincroniza versiones entre version.json y tauri.conf.json
 *
 * Uso:
 *   node scripts/sync-version.js          # Usa version.json como fuente
 *   node scripts/sync-version.js --git    # Usa el tag de git como fuente
 *   node scripts/sync-version.js 2.5.0    # Usa versión específica
 *
 * Este script actualiza:
 *   - frontend/src-tauri/tauri.conf.json (version)
 *   - frontend/src-tauri/Cargo.toml (version)
 *   - frontend/package.json (version)
 *   - version.json (si se pasa --git o versión específica)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Rutas de archivos
const ROOT_DIR = path.join(__dirname, '..');
const VERSION_JSON = path.join(ROOT_DIR, 'version.json');
const TAURI_CONF = path.join(ROOT_DIR, 'frontend', 'src-tauri', 'tauri.conf.json');
const CARGO_TOML = path.join(ROOT_DIR, 'frontend', 'src-tauri', 'Cargo.toml');
const FRONTEND_PACKAGE = path.join(ROOT_DIR, 'frontend', 'package.json');

/**
 * Obtiene la versión del tag de git más reciente
 */
function getGitTagVersion() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    // Quitar 'v' del inicio si existe (v2.4.0 -> 2.4.0)
    return tag.startsWith('v') ? tag.slice(1) : tag;
  } catch (error) {
    console.error('Error: No se encontró ningún tag de git');
    return null;
  }
}

/**
 * Lee un archivo JSON
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Escribe un archivo JSON con formato bonito
 */
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  ✓ Actualizado: ${path.relative(ROOT_DIR, filePath)}`);
}

/**
 * Valida formato de versión semántica
 */
function isValidSemver(version) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
}

// Main
function main() {
  const args = process.argv.slice(2);
  let targetVersion;
  let source;

  // Determinar la versión objetivo
  if (args.includes('--git')) {
    targetVersion = getGitTagVersion();
    source = 'git tag';
    if (!targetVersion) {
      process.exit(1);
    }
  } else if (args[0] && !args[0].startsWith('-')) {
    targetVersion = args[0];
    source = 'argumento';
    if (!isValidSemver(targetVersion)) {
      console.error(`Error: Versión inválida "${targetVersion}". Use formato semántico (ej: 2.4.0)`);
      process.exit(1);
    }
  } else {
    // Usar version.json como fuente
    const versionData = readJson(VERSION_JSON);
    if (!versionData) {
      process.exit(1);
    }
    targetVersion = versionData.apps?.frontend || versionData.system;
    source = 'version.json';
  }

  console.log(`\n📦 Sincronizando versión: ${targetVersion} (fuente: ${source})\n`);

  // Actualizar tauri.conf.json
  const tauriConf = readJson(TAURI_CONF);
  if (tauriConf) {
    const oldVersion = tauriConf.version;
    tauriConf.version = targetVersion;
    writeJson(TAURI_CONF, tauriConf);
    if (oldVersion !== targetVersion) {
      console.log(`     (${oldVersion} → ${targetVersion})`);
    }
  }

  // Actualizar Cargo.toml
  try {
    let cargoContent = fs.readFileSync(CARGO_TOML, 'utf8');
    const oldCargoVersion = cargoContent.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    cargoContent = cargoContent.replace(
      /^version\s*=\s*"[^"]+"/m,
      `version = "${targetVersion}"`
    );
    fs.writeFileSync(CARGO_TOML, cargoContent, 'utf8');
    console.log(`  ✓ Actualizado: ${path.relative(ROOT_DIR, CARGO_TOML)}`);
    if (oldCargoVersion && oldCargoVersion !== targetVersion) {
      console.log(`     (${oldCargoVersion} → ${targetVersion})`);
    }
  } catch (error) {
    console.error(`Error actualizando Cargo.toml:`, error.message);
  }

  // Actualizar frontend/package.json
  const frontendPackage = readJson(FRONTEND_PACKAGE);
  if (frontendPackage) {
    const oldVersion = frontendPackage.version;
    frontendPackage.version = targetVersion;
    writeJson(FRONTEND_PACKAGE, frontendPackage);
    if (oldVersion !== targetVersion) {
      console.log(`     (${oldVersion} → ${targetVersion})`);
    }
  }

  // Actualizar version.json si la fuente no es version.json
  if (source !== 'version.json') {
    const versionData = readJson(VERSION_JSON);
    if (versionData) {
      versionData.apps.frontend = targetVersion;
      // También actualizar system si es mayor
      const systemParts = versionData.system.split('.').map(Number);
      const targetParts = targetVersion.split('.').map(Number);

      if (targetParts[0] > systemParts[0] ||
          (targetParts[0] === systemParts[0] && targetParts[1] > systemParts[1]) ||
          (targetParts[0] === systemParts[0] && targetParts[1] === systemParts[1] && targetParts[2] > systemParts[2])) {
        versionData.system = targetVersion;
      }
      writeJson(VERSION_JSON, versionData);
    }
  }

  console.log(`\n✅ Versión sincronizada: ${targetVersion}\n`);
}

main();
