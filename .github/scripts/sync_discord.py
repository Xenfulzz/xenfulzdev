"""Copy the Discord profile picture onto the site.

Looks up the Discord user (not the bot) with the bot token in DISCORD_BOT_TOKEN,
saves the avatar as profile.png and bumps the ?v= on its links in index.html so
browsers load the new picture. The accent colour stays as set in style.css:
Discord doesn't share Nitro profile theme colours with bots.
"""
import json
import os
import re
import sys
import urllib.request

DISCORD_USER_ID = "621128673294286869"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HEADERS = {"User-Agent": "xenfulz.dev profile sync (https://xenfulz.dev, 1.0)"}


def fetch(url, headers=None):
    request = urllib.request.Request(url, headers={**HEADERS, **(headers or {})})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        sys.exit("DISCORD_BOT_TOKEN secret is not set.")

    user = json.loads(fetch(
        f"https://discord.com/api/v10/users/{DISCORD_USER_ID}",
        {"Authorization": f"Bot {token}"},
    ))
    avatar_hash = user.get("avatar")
    if not avatar_hash:
        print("No Discord avatar set; keeping the current picture.")
        return

    avatar = fetch(f"https://cdn.discordapp.com/avatars/{DISCORD_USER_ID}/{avatar_hash}.png?size=512")
    with open(os.path.join(ROOT, "profile.png"), "wb") as f:
        f.write(avatar)

    html_path = os.path.join(ROOT, "index.html")
    with open(html_path, encoding="utf-8") as f:
        html = f.read()
    version = avatar_hash.removeprefix("a_")[:8]
    html = re.sub(r"profile\.png\?v=[\w-]+", f"profile.png?v={version}", html)
    with open(html_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print(f"Avatar: {avatar_hash}")


if __name__ == "__main__":
    main()
