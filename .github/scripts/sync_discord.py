"""Copy the Discord profile picture and profile colour onto the site.

Reads the Discord user with the bot token in DISCORD_BOT_TOKEN, saves the
avatar as profile.png and writes the profile colour (brightened so it reads
on the dark page) into --accent / --accent-rgb in style.css.
"""
import colorsys
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


def brighten(colour):
    """Same hue, tuned to a soft, bright tone (matches script.js pickAccent)."""
    r, g, b = ((colour >> 16) & 255) / 255, ((colour >> 8) & 255) / 255, (colour & 255) / 255
    h, _, s = colorsys.rgb_to_hls(r, g, b)
    s = min(0.9, max(0.6, s * 1.3))
    return tuple(round(c * 255) for c in colorsys.hls_to_rgb(h, 0.7, s))


def main():
    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        sys.exit("DISCORD_BOT_TOKEN secret is not set.")

    user = json.loads(fetch(
        f"https://discord.com/api/v10/users/{DISCORD_USER_ID}",
        {"Authorization": f"Bot {token}"},
    ))

    # Profile picture
    if user.get("avatar"):
        avatar = fetch(f"https://cdn.discordapp.com/avatars/{DISCORD_USER_ID}/{user['avatar']}.png?size=512")
        with open(os.path.join(ROOT, "profile.png"), "wb") as f:
            f.write(avatar)
        print(f"Avatar: {user['avatar']}")

    # Profile colour
    colour = user.get("accent_color")
    if colour is None and user.get("banner_color"):
        colour = int(user["banner_color"].lstrip("#"), 16)
    if colour is None:
        print("No profile colour set on Discord; keeping the current one.")
        return

    r, g, b = brighten(colour)
    css_path = os.path.join(ROOT, "style.css")
    with open(css_path, encoding="utf-8") as f:
        css = f.read()
    css = re.sub(r"--accent: #[0-9a-fA-F]{6};", f"--accent: #{r:02x}{g:02x}{b:02x};", css, count=1)
    css = re.sub(r"--accent-rgb: \d+, \d+, \d+;", f"--accent-rgb: {r}, {g}, {b};", css, count=1)
    css = re.sub(r"Discord profile colour #[0-9a-fA-F]{6}", f"Discord profile colour #{colour:06x}", css, count=1)
    with open(css_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(css)
    print(f"Colour: #{colour:06x} -> #{r:02x}{g:02x}{b:02x}")


if __name__ == "__main__":
    main()
