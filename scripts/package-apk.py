import os,pathlib,zipfile
root=pathlib.Path(os.environ["MYCLIPS_APK_BUILD"]).resolve()
with zipfile.ZipFile(str(root/"base.apk")) as base, zipfile.ZipFile(str(root/"unsigned.apk"),"w") as out:
    for info in base.infolist():
        out.writestr(info,base.read(info.filename))
    for file in sorted((root/"dex").glob("*.dex")):
        out.write(str(file),file.name,compress_type=zipfile.ZIP_STORED)
