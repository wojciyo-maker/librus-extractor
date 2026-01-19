# Chrome Remote Desktop (Recommended)

# Install the service on Ubuntu:

wget https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
sudo apt install ./chrome-remote-desktop_current_amd64.deb -y

# Setup

https://remotedesktop.google.com/access

# Stop and Start - Must run as user

sudo systemctl restart chrome-remote-desktop@$USER
sudo systemctl status chrome-remote-desktop@$USER

# paramters setu for xcfe
nano ~/.chrome-remote-desktop-session

    #!/bin/bash
    # Clear any existing session variables
    unset SESSION_MANAGER
    unset DBUS_SESSION_BUS_ADDRESS

    # Force XFCE environment variables
    export XDG_SESSION_TYPE=x11
    export XDG_CURRENT_DESKTOP=XFCE
export XDG_CONFIG_DIRS=/etc/xdg

# Start XFCE with a D-Bus bus (essential for settings to work)
exec dbus-launch --exit-with-session startxfce4

chmod +x ~/.chrome-remote-desktop-session

sudo bash -c 'echo "export CHROME_REMOTE_DESKTOP_DEFAULT_DESKTOP_SIZES=1920x1080" >> /etc/environment'

# Improve SWAP File

sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
