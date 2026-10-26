# SuperSnacks

Small, fast upgrades for the sites you use every day, bundled into one lightweight Chrome extension.

## Features

### Google Drive audio player

Adds the controls Drive's audio preview is missing:

- Skip back / forward 10 seconds
- Playback speed from 0.5× to 3× (remembered between files)
- Loop
- A–B repeat

| Key | Action |
| --- | --- |
| `K` | Play / pause |
| `J` / `L` | Back / forward 10 s |
| `Shift` + `,` / `.` | Slower / faster |
| `R` | Loop |
| `0`–`9` | Jump to 0–90% |

Scroll over the speed to change it, click it to reset to 1×.

### Google Meet: present with sound

Meet only lets you share sound from a Chrome tab. With SuperSnacks you can also share sound when presenting **a window** (any app or browser) or **your entire screen**: turn on the audio switch in the share picker.

- Needs Chrome 141 or newer. You can still turn the sound on and off with Meet's **Presentation audio** switch.
- On Windows 11 and macOS 14.2+, the call itself is kept out of what you share.
- On Windows 10, ChromeOS and Linux it can't be, so others may hear themselves while you share sound. SuperSnacks shows a reminder when that's the case.
- Sharing a single window's sound is offered where Chrome supports it; elsewhere the switch shares all sound from your computer.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

## Privacy

SuperSnacks makes no network requests and collects nothing. It only runs on the sites its features need, and its one permission (`storage`) is used to remember your settings.

## Author

Made by **David Kamaly** (zeroyen).

## License

[MIT](LICENSE)
