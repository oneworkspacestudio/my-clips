param(
 [string]$Sdk="$env:LOCALAPPDATA/Android/Sdk",
 [string]$Out='I:/Projects/tooling/my-clips-20261020/android',
 [string]$KeyStore,
 [string]$KeyAlias='my-clips'
)
$ErrorActionPreference='Stop'
if(-not $KeyStore -or -not $env:MYCLIPS_SIGNING_PASSWORD){throw 'Set KeyStore and MYCLIPS_SIGNING_PASSWORD for the release signing key'}
$root=Split-Path $PSScriptRoot -Parent
$tools=Join-Path $Sdk 'build-tools/36.0.0'
$platform=Join-Path $Sdk 'platforms/android-35/android.jar'
New-Item -ItemType Directory -Force $Out | Out-Null
$Out=(Resolve-Path -LiteralPath $Out).Path
New-Item -ItemType Directory -Force "$Out/classes","$Out/generated","$Out/dex","$root/android/res/drawable" | Out-Null
Copy-Item -LiteralPath "$root/web/public/icon-192.png" -Destination "$root/android/res/drawable/icon.png" -Force
& "$tools/aapt2.exe" compile --dir "$root/android/res" -o "$Out/resources.zip"
if($LASTEXITCODE){throw 'Android resource compilation failed'}
& "$tools/aapt2.exe" link -o "$Out/base.apk" -I $platform --manifest "$root/android/AndroidManifest.xml" --java "$Out/generated" --auto-add-overlay "$Out/resources.zip"
if($LASTEXITCODE){throw 'Android resource linking failed'}
$sources=@(Get-ChildItem -LiteralPath "$root/android/src","$Out/generated" -Recurse -Filter '*.java' | Select-Object -ExpandProperty FullName)
& javac --release 17 -classpath $platform -d "$Out/classes" $sources
if($LASTEXITCODE){throw 'Android Java compilation failed'}
$classes=@(Get-ChildItem -LiteralPath "$Out/classes" -Recurse -Filter '*.class' | Select-Object -ExpandProperty FullName)
& "$tools/d8.bat" --lib $platform --min-api 28 --output "$Out/dex" $classes
if($LASTEXITCODE){throw 'Android DEX compilation failed'}
$env:MYCLIPS_APK_BUILD=$Out
python "$root/scripts/package-apk.py"
if($LASTEXITCODE){throw 'APK packaging failed'}
& "$tools/zipalign.exe" -f -p 4 "$Out/unsigned.apk" "$Out/aligned.apk"
if($LASTEXITCODE){throw 'APK alignment failed'}
& "$tools/apksigner.bat" sign --ks $KeyStore --ks-key-alias $KeyAlias --ks-pass env:MYCLIPS_SIGNING_PASSWORD --key-pass env:MYCLIPS_SIGNING_PASSWORD --out "$Out/MyClips-0.1.0-preview.1.apk" "$Out/aligned.apk"
if($LASTEXITCODE){throw 'APK signing failed'}
& "$tools/apksigner.bat" verify --verbose --print-certs "$Out/MyClips-0.1.0-preview.1.apk"
if($LASTEXITCODE){throw 'APK signature verification failed'}
& "$tools/aapt2.exe" dump badging "$Out/MyClips-0.1.0-preview.1.apk"
if($LASTEXITCODE){throw 'APK metadata validation failed'}
