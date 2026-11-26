#!/usr/bin/env python3
"""Makes the generated Android project sign release builds with the Play upload key.

The key comes from environment variables set in GitHub Actions (never stored in the repository):
XM_UPLOAD_STORE_FILE, XM_UPLOAD_STORE_PASSWORD, XM_UPLOAD_KEY_ALIAS, XM_UPLOAD_KEY_PASSWORD.
Run from mobile/ after `expo prebuild`.
"""
import re
import sys

path = 'android/app/build.gradle'
text = open(path, encoding='utf-8').read()

release_config = """        release {
            storeFile file(System.getenv('XM_UPLOAD_STORE_FILE'))
            storePassword System.getenv('XM_UPLOAD_STORE_PASSWORD')
            keyAlias System.getenv('XM_UPLOAD_KEY_ALIAS')
            keyPassword System.getenv('XM_UPLOAD_KEY_PASSWORD')
        }
"""
if "System.getenv('XM_UPLOAD_STORE_FILE')" not in text:
    text, n = re.subn(r'(signingConfigs \{\n)', r'\1' + release_config.replace('\\', '\\\\'), text, count=1)
    if n != 1:
        sys.exit('signingConfigs block not found')

# the release build type uses the upload key instead of the debug key
release_type = re.search(r'buildTypes \{.*?\n        release \{(.*?)\n        \}', text, re.S)
if not release_type:
    sys.exit('release build type not found')
body = release_type.group(1)
new_body = body.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release')
text = text[:release_type.start(1)] + new_body + text[release_type.end(1):]
if 'signingConfig signingConfigs.release' not in text:
    sys.exit('could not switch the release signing config')

open(path, 'w', encoding='utf-8').write(text)
print('release builds are signed with the Play upload key')
