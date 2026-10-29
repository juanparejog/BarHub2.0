#!/usr/bin/env python3
import os
import sys
import subprocess

def run_cmd(cmd, shell=False, env=None, input_data=None):
    """Ejecuta un comando de forma segura pasándole listas limpias de argumentos."""
    try:
        print(f"[+] Ejecutando: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
        current_env = os.environ.copy()
        if env:
            current_env.update(env)
            
        result = subprocess.run(
            cmd, 
            shell=shell, 
            check=True, 
            text=True, 
            capture_output=True, 
            env=current_env,
            input=input_data
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"[-] Error al ejecutar: {e}\nSalida de error: {e.stderr}")
        return None

def check_root():
    if os.geteuid() != 0:
        print("[!] Este script debe ejecutarse como ROOT (sudo python3 script-hardening.py)")
        sys.exit(1)

def paso_0_preparacion():
    print("\n=== [0] Preparación e Instalación de Docker ===")
    run_cmd(["rm", "-f", "/etc/apt/sources.list.d/docker.list"])
    run_cmd(["mkdir", "-p", "/etc/apt/keyrings"])
    run_cmd(["curl", "-fsSL", "https://download.docker.com/linux/debian/gpg", "-o", "/etc/apt/keyrings/docker.asc"])
    run_cmd(["chmod", "a+r", "/etc/apt/keyrings/docker.asc"])
    
    repo_line = 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable'
    with open("/etc/apt/sources.list.d/docker.list", "w") as f:
        f.write(repo_line + "\n")
        
    run_cmd(["apt", "update"])
    run_cmd(["apt", "install", "lynis", "curl", "docker-ce", "docker-ce-cli", "containerd.io", "docker-compose-plugin", "-y"])
    
    if os.path.exists("/lib/systemd/system/docker.service"):
        run_cmd(["systemctl", "start", "docker"])
        run_cmd(["systemctl", "enable", "docker"])

def paso_1_usuarios_y_permisos():
    print("\n=== [1] Gestión de Usuarios y Directivas PAM ===")
    run_cmd(["apt", "install", "libpam-tmpdir", "libpam-pwquality", "-y"])
    
    # Forzar directivas de caducidad y seguridad en login.defs
    login_defs_path = "/etc/login.defs"
    if os.path.exists(login_defs_path):
        with open(login_defs_path, "r") as f:
            content = f.read()
        
        directives = {
            "PASS_MIN_DAYS": "7",
            "PASS_MAX_DAYS": "90",
            "PASS_WARN_DAYS": "7",
            "UMASK": "027",
            "SHA_CRYPT_MIN_ROUNDS": "5000",
            "SHA_CRYPT_MAX_ROUNDS": "10000"
        }
        
        with open(login_defs_path, "a") as f:
            f.write("\n# Hardening Directives Added by Script\n")
            for key, val in directives.items():
                if key not in content:
                    f.write(f"{key}\t{val}\n")

    with open("/etc/security/pwquality.conf", "w") as f:
        f.write("minlen = 12\ndcredit = -1\nucredit = -1\nlcredit = -1\nocredit = -1\nminclass = 3\n")

    with open("/etc/pam.d/common-password", "r+") as f:
        content = f.read()
        if "pam_pwhistory.so" not in content:
            f.write("\npassword required pam_pwhistory.so remember=13 use_authtok\n")

    run_cmd(["chmod", "700", "/etc/crontab"])
    run_cmd("chmod 700 /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly", shell=True)

def paso_2_banners():
    print("\n=== [2] Configuración de Banners Legales ===")
    banner_text = "Authorized uses only. All activity may be monitored and reported.\n"
    with open("/etc/issue.net", "w") as f:
        f.write(banner_text)
    with open("/etc/issue", "w") as f:
        f.write(banner_text)

def paso_3_kernel():
    print("\n=== [3] Ajustando Directivas de Kernel (sysctl) ===")
    sysctl_hardened = """
dev.tty.ldisc_autoload = 0
fs.protected_fifos = 2
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.sysrq = 0
kernel.unprivileged_bpf_disabled = 1
kernel.yama.ptrace_scope = 1
net.core.bpf_jit_harden = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
kernel.randomize_va_space = 2
kernel.modules_disabled = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.default.log_martians = 1
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_synack_retries = 5
net.ipv4.tcp_rfc1337 = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
"""
    with open("/etc/sysctl.conf", "a") as f:
        f.write(sysctl_hardened)
    run_cmd(["sysctl", "-p"])

def paso_4_eliminar_servicios():
    print("\n=== [4] Eliminando Servicios Inseguros ===")
    run_cmd(["apt", "remove", "rsh-client", "atftpd", "tftp", "-y"])
    run_cmd(["apt", "autoremove", "-y"])

def paso_5_auditoria():
    print("\n=== [5] Auditoría Avanzada y Logs ===")
    run_cmd(["apt", "install", "apt-listbugs", "apt-listchanges", "debsums", "apt-show-versions", "fail2ban", "aide", "-y"])
    run_cmd(["apt", "install", "acct", "auditd", "sysstat", "rkhunter", "chkrootkit", "needrestart", "-y"])
    
    run_cmd(["sed", "-i", 's/ENABLED="false"/ENABLED="true"/g', "/etc/default/sysstat"])
    run_cmd(["systemctl", "enable", "--now", "auditd"])
    run_cmd(["systemctl", "enable", "--now", "sysstat"])
    
    print("[*] Inyectando set de reglas robustas de supervisión en auditd...")
    run_cmd(["curl", "-fsSL", "https://raw.githubusercontent.com/Neo23x0/auditd/master/audit.rules", "-o", "/etc/audit/rules.d/audit.rules"])
    run_cmd(["systemctl", "restart", "auditd"])

def paso_6_compiladores_y_modulos():
    print("\n=== [6] Robustecimiento de Compiladores y Módulos de Red ===")
    run_cmd("chmod 700 /usr/bin/gcc /usr/bin/g++ /usr/bin/make 2>/dev/null || true", shell=True)
    
    print("[*] Deshabilitando protocolos de red poco comunes (DCCP, SCTP, RDS, TIPC)...")
    uncommon_protocols = "install dccp /bin/true\ninstall sctp /bin/true\ninstall rds /bin/true\ninstall tipc /bin/true\n"
    with open("/etc/modprobe.d/blacklist-uncommon.conf", "w") as f:
        f.write(uncommon_protocols)

def paso_7_cifrado():
    print("\n=== [7] Configuración de Integridad (AIDE) ===")
    aide_conf_dir = "/etc/aide/aide.conf.d"
    if os.path.exists(aide_conf_dir):
        run_cmd("find /etc/aide/aide.conf.d/ -type f -exec sed -i 's/KALI-ROLLING/kali/g' {} +", shell=True)
    
    print("[*] Inicializando base de datos AIDE...")
    run_cmd(["aide", "--init", "--config", "/etc/aide/aide.conf"])
    if os.path.exists("/var/lib/aide/aide.db.new"):
        run_cmd(["mv", "/var/lib/aide/aide.db.new", "/var/lib/aide/aide.db"])

def paso_8_ssh_hardening():
    print("\n=== [8] Hardening Avanzado de OpenSSH (Clave Pública Exclusiva) ===")
    if os.path.exists("/etc/ssh/sshd_config") and not os.path.exists("/etc/ssh/sshd_config.bak"):
        run_cmd(["cp", "/etc/ssh/sshd_config", "/etc/ssh/sshd_config.bak"])
    
    ssh_dir = "/root/.ssh"
    if os.path.exists(ssh_dir):
        run_cmd(["chmod", "700", ssh_dir])
        auth_keys = os.path.join(ssh_dir, "authorized_keys")
        if os.path.exists(auth_keys):
            run_cmd(["chmod", "600", auth_keys])

    ssh_conf = "\nProtocol 2\nPort 22022\nPermitRootLogin prohibit-password\nPubkeyAuthentication yes\nPasswordAuthentication no\nPermitEmptyPasswords no\nMaxAuthTries 3\nMaxSessions 2\nClientAliveInterval 300\nClientAliveCountMax 2\nX11Forwarding no\nAllowTcpForwarding no\nLogLevel VERBOSE\nBanner /etc/issue.net\n"
    
    with open("/etc/ssh/sshd_config", "a") as f:
        f.write(ssh_conf)
    
    run_cmd(["sshd", "-t"])
    run_cmd(["systemctl", "restart", "ssh"])

def paso_9_red():
    print("\n=== [9] Control de Acceso por Red (TCP Wrappers) ===")
    with open("/etc/hosts.deny", "w") as f:
        f.write("ALL : ALL\n")
    
    with open("/etc/hosts.allow", "w") as f:
        f.write("sshd : ALL\n")
        
    if os.path.exists("/etc/fail2ban/jail.conf"):
        run_cmd(["cp", "/etc/fail2ban/jail.conf", "/etc/fail2ban/jail.local"])
        run_cmd(["systemctl", "restart", "fail2ban"])

def paso_10_firewall():
    print("\n=== [10] Firewall Local (iptables y Netfilter) ===")
    run_cmd(["debconf-set-selections"], input_data="iptables-persistent iptables-persistent/v4save boolean true\n")
    run_cmd(["debconf-set-selections"], input_data="iptables-persistent iptables-persistent/v6save boolean true\n")
        
    apt_env = {
        "DEBIAN_FRONTEND": "noninteractive",
        "DEBCONF_NONINTERACTIVE_SEEN": "true"
    }
    run_cmd(
        ["apt", "-y", "-o", "Dpkg::Options::=--force-confdef", "-o", "Dpkg::Options::=--force-confold", "install", "iptables-persistent", "netfilter-persistent", "apparmor-profiles", "apparmor-utils"], 
        env=apt_env
    )
        
    print("[*] Aplicando reglas firewall estrictas compatibles con Docker...")
    run_cmd(["iptables", "-F"])
    run_cmd(["iptables", "-A", "INPUT", "-i", "lo", "-j", "ACCEPT"])
    run_cmd(["iptables", "-A", "INPUT", "-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "ACCEPT"])
    run_cmd(["iptables", "-A", "INPUT", "-p", "tcp", "--dport", "22022", "-m", "conntrack", "--ctstate", "NEW", "-j", "ACCEPT"])
    run_cmd(["iptables", "-A", "INPUT", "-p", "tcp", "--dport", "80", "-m", "conntrack", "--ctstate", "NEW", "-j", "ACCEPT"])
    run_cmd(["iptables", "-A", "INPUT", "-p", "tcp", "--dport", "443", "-m", "conntrack", "--ctstate", "NEW", "-j", "ACCEPT"])
    
    run_cmd(["iptables", "-P", "INPUT", "DROP"])
    run_cmd(["iptables", "-P", "FORWARD", "ACCEPT"])
    run_cmd(["iptables", "-P", "OUTPUT", "ACCEPT"])
    
    run_cmd(["netfilter-persistent", "save"])

def main():
    check_root()
    print("==================================================")
    print("[*] Iniciando Script de Hardening")
    print("==================================================")
    paso_0_preparacion()
    paso_1_usuarios_y_permisos()
    paso_2_banners()
    paso_3_kernel()
    paso_4_eliminar_servicios()
    paso_5_auditoria()
    paso_6_compiladores_y_modulos()
    paso_7_cifrado()
    paso_8_ssh_hardening()
    paso_9_red()
    paso_10_firewall()
    print("\n==================================================")
    print("[✓] Hardening completado con éxito.")
    print("==================================================")

if __name__ == "__main__":
    main()