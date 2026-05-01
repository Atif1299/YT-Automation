App icon for electron-builder (required for reliable WiX/MSI builds):

- package.json sets "icon": "build/icon.png"
- A minimal placeholder PNG is committed so MSI links succeed; replace with a 512x512 (or larger) PNG for production branding.

Windows may also use icon.ico; macOS can use icon.icns — see:
https://www.electron.build/configuration/configuration#Configuration-icon
