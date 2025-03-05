import requests
import random
import time
import base64
import json
from bs4 import BeautifulSoup

###############################################################################
# 1) FREEPROXY.WORLD SCRAPER (ORIGINAL LOGIC)
###############################################################################

def get_jp_proxies_from_freeproxy_world():
    """
    Scrapes the https://www.freeproxy.world/?country=JP page for proxies from Japan.
    Returns a list of dicts with keys: 'ip', 'port', and 'type' (one of 'http', 'socks4', 'socks5', etc.)
    """
    url = "https://www.freeproxy.world/?country=JP"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except Exception as e:
        print("Error fetching freeproxy.world page:", e)
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    proxies = []
    table = soup.find("table", class_="layui-table")
    if not table:
        print("Proxy table not found on freeproxy.world.")
        return proxies

    tbody = table.find("tbody")
    if not tbody:
        print("Table body not found on freeproxy.world.")
        return proxies

    rows = tbody.find_all("tr")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 6:
            continue

        ip_cell = row.find("td", class_="show-ip-div")
        if ip_cell:
            ip = ip_cell.get_text(strip=True)
        else:
            ip = cells[0].get_text(strip=True)

        port = cells[1].get_text(strip=True)
        proxy_type = cells[5].get_text(strip=True).lower()
        proxy_type = proxy_type.split()[0]  # e.g. "http", "socks4", "socks5"

        if ip and port and proxy_type:
            proxies.append({
                "ip": ip,
                "port": port,
                "type": proxy_type,
            })

    print(f"[freeproxy.world] Found {len(proxies)} proxies.")
    return proxies


###############################################################################
# 2) PROXYSCRAPE
###############################################################################

def get_jp_proxies_from_proxyscrape():
    """
    Fetches free Japanese proxies from ProxyScrape.
    Returns a list of dicts with 'ip', 'port', 'type'.
    """
    base_url = "https://api.proxyscrape.com/v2/?request=displayproxies&country=JP&timeout=10000&anonymity=all"
    all_proxies = []
    protocols = [("http", "http"), ("socks4", "socks4"), ("socks5", "socks5")]
    
    for proto_param, proto_type in protocols:
        url = f"{base_url}&protocol={proto_param}"
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            lines = resp.text.strip().splitlines()
            for line in lines:
                line = line.strip()
                if not line or ":" not in line:
                    continue
                ip, port = line.split(":")
                all_proxies.append({
                    "ip": ip.strip(),
                    "port": port.strip(),
                    "type": proto_type
                })
        except Exception as e:
            print(f"[ProxyScrape - {proto_param}] Error:", e)

    print(f"[ProxyScrape] Total proxies found: {len(all_proxies)}")
    return all_proxies


###############################################################################
# 3) PROXYSCAN.IO
###############################################################################

def get_jp_proxies_from_proxyscan():
    """
    Fetch free Japanese proxies from Proxyscan.io in JSON format.
    Returns a list of dicts with 'ip', 'port', 'type'.
    """
    url = "https://www.proxyscan.io/api/proxy?country=JP&type=http,https,socks4,socks5&limit=20&format=json"
    proxies_list = []
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for entry in data:
            ip = entry.get("Ip")
            port = entry.get("Port")
            ptype = entry.get("Type", "").lower()
            if ip and port and ptype:
                if ptype == "https":
                    ptype = "http"
                proxies_list.append({
                    "ip": ip.strip(),
                    "port": port.strip(),
                    "type": ptype
                })
    except Exception as e:
        print("[Proxyscan] Error:", e)

    print(f"[Proxyscan] Found {len(proxies_list)} proxies.")
    return proxies_list


###############################################################################
# 4) PUBPROXY
###############################################################################

def get_jp_proxies_from_pubproxy():
    """
    Fetch free Japanese proxies from PubProxy.
    Returns a list of dicts with 'ip', 'port', 'type'.
    """
    base_url = "http://pubproxy.com/api/proxy"
    proxies_list = []

    # HTTP proxies that support HTTPS
    try:
        url_http = f"{base_url}?country=JP&limit=20&type=http&https=true&format=json"
        resp = requests.get(url_http, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("data", []):
            ip_port = item.get("ipPort", "")
            if ip_port:
                ip, port = ip_port.split(":")
                proxies_list.append({
                    "ip": ip.strip(),
                    "port": port.strip(),
                    "type": "http"
                })
    except Exception as e:
        print("[PubProxy - HTTP] Error:", e)

    # SOCKS4
    try:
        url_socks4 = f"{base_url}?country=JP&limit=20&type=socks4&format=json"
        resp = requests.get(url_socks4, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("data", []):
            ip_port = item.get("ipPort", "")
            if ip_port:
                ip, port = ip_port.split(":")
                proxies_list.append({
                    "ip": ip.strip(),
                    "port": port.strip(),
                    "type": "socks4"
                })
    except Exception as e:
        print("[PubProxy - SOCKS4] Error:", e)

    # SOCKS5
    try:
        url_socks5 = f"{base_url}?country=JP&limit=20&type=socks5&format=json"
        resp = requests.get(url_socks5, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("data", []):
            ip_port = item.get("ipPort", "")
            if ip_port:
                ip, port = ip_port.split(":")
                proxies_list.append({
                    "ip": ip.strip(),
                    "port": port.strip(),
                    "type": "socks5"
                })
    except Exception as e:
        print("[PubProxy - SOCKS5] Error:", e)

    print(f"[PubProxy] Found {len(proxies_list)} proxies.")
    return proxies_list


###############################################################################
# 5) GETPROXYLIST
###############################################################################

def get_jp_proxies_from_getproxylist(num_requests=10):
    """
    Fetch free Japanese proxies from GetProxyList.com.
    Returns a list of dicts with 'ip', 'port', 'type'.
    """
    base_url = "https://api.getproxylist.com/proxy?country[]=JP"
    proxies_list = []

    for _ in range(num_requests):
        try:
            resp = requests.get(base_url, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            ip = data.get("ip")
            port = data.get("port")
            protocols = data.get("protocols", [])
            if not protocols:
                proto = data.get("protocol", "").lower()
                if proto:
                    protocols = [proto]

            for proto in protocols:
                proto = proto.lower()
                if proto == "https":
                    proto = "http"
                if ip and port and proto in ("http", "socks4", "socks5"):
                    proxies_list.append({
                        "ip": str(ip).strip(),
                        "port": str(port).strip(),
                        "type": proto
                    })
        except Exception as e:
            print("[GetProxyList] Single request error:", e)
            continue

    print(f"[GetProxyList] Gathered {len(proxies_list)} proxies from {num_requests} requests.")
    return proxies_list


###############################################################################
# COMMON LOGIC: FETCHING RSS WITH A GIVEN PROXY
###############################################################################

def fetch_rss_with_proxy(rss_url, proxy_data):
    """
    Attempts to fetch the RSS feed using the provided proxy information.
    Returns the RSS content on success, or None on failure/invalid content.
    """
    proxy_type = proxy_data.get("type", "http")
    ip = proxy_data["ip"]
    port = proxy_data["port"]
    proxy_url = f"{proxy_type}://{ip}:{port}"

    proxies = {
        "http": proxy_url,
        "https": proxy_url
    }
    try:
        print(f"  Trying {proxy_type.upper()} proxy {ip}:{port} ...")
        response = requests.get(rss_url, proxies=proxies, timeout=15)
        response.raise_for_status()
        content = response.text
        if "<dc:date>" not in content:
            print("    Content does NOT contain <dc:date>; not a valid RSS feed.")
            return None
        return content
    except Exception as e:
        print(f"    Failed with {ip}:{port} ({proxy_type}):", e)
        return None


def try_all_proxies_once(rss_url, proxies_list):
    """
    Tries every proxy in proxies_list (in the given order) to fetch valid RSS.
    Returns the RSS content if successful, else None.
    """
    for proxy_data in proxies_list:
        rss_content = fetch_rss_with_proxy(rss_url, proxy_data)
        if rss_content:
            return rss_content
    return None


def try_proxies_multiple_attempts(rss_url, proxies_list, attempts=2):
    """
    Shuffles the list of proxies and attempts to fetch the RSS feed multiple times.
    Returns the content as soon as one works, else None.
    """
    for attempt_idx in range(attempts):
        print(f"\nAttempt {attempt_idx+1} of {attempts} ...")
        random.shuffle(proxies_list)
        rss_content = try_all_proxies_once(rss_url, proxies_list)
        if rss_content:
            return rss_content
    return None


###############################################################################
# NEW FUNCTION: UPDATE GITHUB FILE WITH THE RSS CONTENT
###############################################################################

def update_github_rss_feed(rss_content):
    """
    Uses the GitHub API to update (or create) the file in your repository with the new RSS content.
    The content is completely replaced with the new data.
    """
    # ======= CONFIGURATION (UPDATED) =======
    GITHUB_TOKEN = "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"
    REPO_OWNER = "ituberus"        # Your GitHub username
    REPO_NAME = "Rdmansi"          # The repository name
    FILE_PATH = "rss.xml"          # The file to update
    BRANCH = "master"
                # The branch to commit to
    # =========================================

    # GitHub API URL for file contents
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{FILE_PATH}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }

    # Check if the file already exists to retrieve its SHA
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        file_info = response.json()
        sha = file_info.get("sha")
        print("File exists in repo; will update it.")
    else:
        sha = None
        print("File does not exist; will create a new one.")

    # Encode the RSS content to base64 as required by GitHub API
    b64_content = base64.b64encode(rss_content.encode()).decode()

    data = {
        "message": "Update RSS feed",
        "content": b64_content,
        "branch": BRANCH
    }
    if sha:
        data["sha"] = sha

    put_response = requests.put(url, headers=headers, data=json.dumps(data))
    if put_response.status_code in (200, 201):
        print("Successfully updated the GitHub repository with the new RSS feed.")
    else:
        print("Failed to update the GitHub repository. Status Code:", put_response.status_code)
        print("Response:", put_response.json())


###############################################################################
# MAIN LOGIC
###############################################################################

def main():
    rss_url = "http://totogun.com/bbs/rss.php?bo_table=gnb_13"  # Replace with your desired RSS URL

    # 1) Try freeproxy.world proxies (3 attempts)
    print("Fetching JP proxies from freeproxy.world ...")
    freeproxy_world_list = get_jp_proxies_from_freeproxy_world()
    if freeproxy_world_list:
        print("\nUsing freeproxy.world proxies (3 attempts):")
        rss_content = try_proxies_multiple_attempts(rss_url, freeproxy_world_list, attempts=3)
        if rss_content:
            print("\nSuccessfully fetched RSS using freeproxy.world proxy!")
            update_github_rss_feed(rss_content)
            return
    else:
        print("No Japanese proxies found on freeproxy.world or request failed.")

    # 2) If not successful, try ProxyScrape (2 attempts)
    print("\nNow trying ProxyScrape (2 attempts) ...")
    pscrape_list = get_jp_proxies_from_proxyscrape()
    if pscrape_list:
        rss_content = try_proxies_multiple_attempts(rss_url, pscrape_list, attempts=2)
        if rss_content:
            print("\nSuccessfully fetched RSS using ProxyScrape proxy!")
            update_github_rss_feed(rss_content)
            return
    else:
        print("No JP proxies found on ProxyScrape or request failed.")

    # 3) Try Proxyscan.io (2 attempts)
    print("\nNow trying Proxyscan.io (2 attempts) ...")
    pscan_list = get_jp_proxies_from_proxyscan()
    if pscan_list:
        rss_content = try_proxies_multiple_attempts(rss_url, pscan_list, attempts=2)
        if rss_content:
            print("\nSuccessfully fetched RSS using Proxyscan.io proxy!")
            update_github_rss_feed(rss_content)
            return
    else:
        print("No JP proxies found on Proxyscan.io or request failed.")

    # 4) Try PubProxy (2 attempts)
    print("\nNow trying PubProxy (2 attempts) ...")
    pubproxy_list = get_jp_proxies_from_pubproxy()
    if pubproxy_list:
        rss_content = try_proxies_multiple_attempts(rss_url, pubproxy_list, attempts=2)
        if rss_content:
            print("\nSuccessfully fetched RSS using PubProxy!")
            update_github_rss_feed(rss_content)
            return
    else:
        print("No JP proxies found on PubProxy or request failed.")

    # 5) Try GetProxyList (2 attempts)
    print("\nNow trying GetProxyList (2 attempts) ...")
    gpl_list = get_jp_proxies_from_getproxylist(num_requests=10)
    if gpl_list:
        rss_content = try_proxies_multiple_attempts(rss_url, gpl_list, attempts=2)
        if rss_content:
            print("\nSuccessfully fetched RSS using GetProxyList!")
            update_github_rss_feed(rss_content)
            return
    else:
        print("No JP proxies found from GetProxyList or requests failed.")

    print("\nFAILED to fetch a valid RSS feed after all attempts.")


if __name__ == "__main__":
    main()
