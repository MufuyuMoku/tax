"""Check that the connection does not go through a VPN or a proxy before fetching (SPEC section 8).

A VPN counts as a proxy: going around a restriction by changing the address we appear to come from
is exactly what the fetching rules forbid. What can be checked on this machine is checked; what
cannot (a VPN on the router, a corporate proxy upstream) is left to a human, who confirms it.

The checks look only at this machine. They contact no outside service: asking a third party
"what is my IP" would itself send something somewhere.
"""
import os
import platform
import shutil
import subprocess

PROXY_VARIABLES = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")
VPN_ADAPTER_WORDS = (
    "vpn", "tap-", "tap ", "tun", "wintun", "wireguard", "openvpn", "cloudflare", "warp", "nordlynx",
    "proton", "tailscale", "zerotier", "fortinet", "cisco anyconnect", "globalprotect", "sing-box", "clash",
)


def _powershell(command):
    exe = shutil.which("powershell") or shutil.which("pwsh")
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "-NoProfile", "-NonInteractive", "-Command", command],
                             capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return out.stdout


def _windows_findings():
    found, unsure = [], []
    adapters = _powershell(
        "Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { $_.Name + ' | ' + $_.InterfaceDescription }"
    )
    if adapters is None:
        unsure.append("daftar adapter jaringan tidak bisa dibaca")
    else:
        for line in adapters.splitlines():
            low = line.lower()
            if any(word in low for word in VPN_ADAPTER_WORDS):
                found.append(f"adapter aktif yang tampak seperti VPN: {line.strip()}")
    proxy = _powershell(
        "$p = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';"
        " '' + $p.ProxyEnable + '|' + $p.AutoConfigURL"
    )
    if proxy is not None:
        enable, _, pac = proxy.strip().partition("|")
        if enable.strip() == "1":
            found.append("proxy sistem Windows aktif")
        if pac.strip():
            found.append("skrip konfigurasi proxy (PAC) Windows terpasang")
    for cli in ("warp-cli", r"C:\Program Files\Cloudflare\Cloudflare WARP\warp-cli.exe"):
        path = shutil.which(cli) or (cli if os.path.exists(cli) else None)
        if path:
            try:
                status = subprocess.run([path, "status"], capture_output=True, text=True, timeout=30).stdout
            except (OSError, subprocess.TimeoutExpired):
                unsure.append("status Cloudflare WARP tidak bisa dibaca")
                break
            if "Connected" in status and "Disconnected" not in status:
                found.append("Cloudflare WARP tersambung")
            break
    return found, unsure


def _linux_findings():
    """Network interfaces whose names look like a VPN (tun0, wg0, tailscale0, ...), from /sys."""
    found = []
    net = "/sys/class/net"
    if not os.path.isdir(net):
        return found, ["daftar adapter jaringan (/sys/class/net) tidak bisa dibaca"]
    for name in sorted(os.listdir(net)):
        low = name.lower()
        if low.startswith(("tun", "tap", "wg", "ppp")) or any(word.strip() in low for word in VPN_ADAPTER_WORDS if len(word.strip()) > 3):
            found.append(f"adapter jaringan {name} tampak seperti VPN")
    return found, []


def check():
    """Return (blocking findings, things that could not be checked)."""
    found = [f"variabel lingkungan {name} berisi proxy" for name in PROXY_VARIABLES if os.environ.get(name)]
    unsure = ["VPN atau proxy di router atau jaringan kantor tidak bisa dilihat dari mesin ini"]
    if platform.system() == "Windows":
        more_found, more_unsure = _windows_findings()
        found += more_found
        unsure += more_unsure
    elif platform.system() == "Linux":
        # A small Linux server can run the update (M7, K-085): its adapters are checked too.
        more_found, more_unsure = _linux_findings()
        found += more_found
        unsure += more_unsure
    else:
        unsure.append("pemeriksaan adapter VPN hanya tersedia di Windows dan Linux")
    return found, unsure


REMINDER = """\
Pengingat aturan pengambilan (SPEC bagian 8): VPN termasuk proxy. Pastikan koneksi ini koneksi biasa,
tanpa VPN (termasuk Cloudflare WARP), tanpa proxy, dan bukan jaringan yang menyamarkan alamat."""


def require_plain_connection(confirmed):
    """Raise SystemExit unless the connection looks plain and a human has confirmed it."""
    found, unsure = check()
    if found:
        raise SystemExit("Pengambilan ditolak, koneksi tampak lewat VPN atau proxy:\n- " + "\n- ".join(found))
    print(REMINDER)
    print("Yang tidak bisa diperiksa otomatis:\n- " + "\n- ".join(unsure))
    if confirmed:
        print("Dikonfirmasi dengan --tanpa-vpn.")
        return
    try:
        answer = input('Ketik "tanpa vpn" untuk melanjutkan: ')
    except EOFError:
        answer = ""
    if answer.strip().lower() != "tanpa vpn":
        raise SystemExit("Tidak dikonfirmasi; pengambilan tidak dijalankan.")
