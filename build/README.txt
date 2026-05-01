App icon for electron-builder (required for reliable WiX/MSI builds):

- package.json sets "icon": "build/icon.png"
- Use at least 512x512 PNG (electron-builder requires this for macOS; a 256x256 icon fails Darwin builds). Regenerate: scripts/generate-512-icon.ps1

Windows may also use icon.ico; macOS can use icon.icns — see:
https://www.electron.build/configuration/configuration#Configuration-icon
