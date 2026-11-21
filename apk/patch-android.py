# -*- coding: utf-8 -*-
"""Expo prebuild 后的 Android 工程补丁：华为云镜像 + 明文 HTTP + SDK 路径"""
import sys, os, shutil, re

APPS = ["staff", "patient"]
BASE = os.path.dirname(os.path.abspath(__file__))
HUAWEI = "maven { url 'https://repo.huaweicloud.com/repository/maven/' }"

def patch_build_gradle(p):
    s = open(p, encoding="utf-8").read()
    if "huaweicloud" in s:
        return
    s = s.replace("buildscript {\n  repositories {\n    google()",
                  "buildscript {\n  repositories {\n    " + HUAWEI + "\n    google()")
    s = s.replace("allprojects {\n  repositories {\n    google()",
                  "allprojects {\n  repositories {\n    " + HUAWEI + "\n    google()")
    open(p, "w", encoding="utf-8").write(s)

def patch_settings(p):
    s = open(p, encoding="utf-8").read()
    if "huaweicloud" in s:
        return
    s = s.replace("pluginManagement {\n",
                  "pluginManagement {\n  repositories {\n    " + HUAWEI + "\n    google()\n    mavenCentral()\n  }\n", 1)
    open(p, "w", encoding="utf-8").write(s)

def patch_manifest(p):
    s = open(p, encoding="utf-8").read()
    if "usesCleartextTraffic" in s:
        return
    s = s.replace("<application ", '<application android:usesCleartextTraffic="true" ', 1)
    open(p, "w", encoding="utf-8").write(s)

for app in APPS:
    adir = os.path.join(BASE, "apps", app, "android")
    patch_build_gradle(os.path.join(adir, "build.gradle"))
    patch_settings(os.path.join(adir, "settings.gradle"))
    m = os.path.join(adir, "app", "src", "main", "AndroidManifest.xml")
    if os.path.exists(m):
        patch_manifest(m)
    lp = os.path.join(adir, "local.properties")
    open(lp, "w").write("sdk.dir=C\\:\\\\Users\\\\zhang\\\\Android\\\\Sdk\n")
    print(app, "patched")
