import urllib.request, ssl, os
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
os.makedirs(r"C:\Users\zhang\Desktop\MediCode\frontend\src\assets", exist_ok=True)
urls = {
    r"C:\Users\zhang\Desktop\MediCode\frontend\src\assets\icon-staff.png": "https://aka.doubaocdn.com/s/Fo61miQ0Kf",
    r"C:\Users\zhang\Desktop\MediCode\frontend\src\assets\icon-patient.png": "https://aka.doubaocdn.com/s/KcrKnKWeeJ",
}
for path, url in urls.items():
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    print(path, len(data))
