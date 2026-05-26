# 📚 ShelfLife

<div align="center">
  <p><strong>A feature-rich companion dashboard for Audiobookshelf.</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/React-19.0-blue?style=for-the-badge&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Express-4.21-lightgrey?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/Capacitor-v8.3-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
    <img src="https://img.shields.io/badge/Android-Native-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  </p>
</div>

---

**ShelfLife** is a companion dashboard and mobile app designed for [Audiobookshelf](https://www.audiobookshelf.org/), a self-hosted audiobook and podcast server. 

ShelfLife delivers real-time listening logs, advanced stats, library audits, ASIN matching tools, and deep active-session tracking. Think of Tautulli for Audiobookshelf.

## 🌟 Key Features

*   📊 **Real-Time Listener Dashboard**: Monitor system-wide listening statistics, server status, library sizes, and active listener sessions at a glance.
*   📈 **Deep Listener Analytics**: Visualize patterns with GitHub-style activity heatmaps, daily listening averages, completion rates, top genres, and device usage logs.
*   📚 **Interactive Library Audits**: Search and inspect your audiobooks across different libraries with responsive cover previews, duration info, and detail modals showing listening history and chapter listings.
*   🔍 **Audnex Book Matching**: Integrated ASIN (Audible) lookups that fetch metadata, descriptions, and chapters automatically to help you clean up and match your library's books.
*   📱 **Native Android Integration**: Built with Capacitor.


## ⚙️ Quick Start (Local Run)

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   An active [Audiobookshelf](https://www.audiobookshelf.org/) server instance


### Step 1: Install Dependencies

Clone this repository to your system and install the required packages:

```bash
npm install
```

### Step 2: Configure Environment Variables

Create a `.env` file in the root of the project using the template provided in `.env.example`:

```bash
cp .env.example .env
```

Open the `.env` file and configure it with your Audiobookshelf server details:

```ini
# Port where the ShelfLife server will run (default is 3000)
PORT=3000

# The URL of your Audiobookshelf instance
ABS_URL="https://audiobookshelf.example.com"

# Your Audiobookshelf API Token (admin dashboard or user token)
ABS_TOKEN="your_private_api_token"

# Optional: Custom headers in JSON format (e.g. for Cloudflare Access bypass)
# ABS_EXTRA_HEADERS='{"CF-Access-Client-Id": "xyz", "CF-Access-Client-Secret": "abc"}'
```

### Step 3: Run the Development Server

Start both the backend proxy and the Vite development server simultaneously:

```bash
npm run dev
```

Visit the app in your browser at `http://localhost:3000`.

### Step 4: Build for Production

Compile the optimized static frontend bundle:

```bash
npm run build
```

To host ShelfLife in production, run:

```bash
npm run start
```



## 📱 Mobile Deployment (Android Native)

ShelfLife includes native mobile support via Capacitor.

### Build and Install Automatically (via Bash Script)

If you have an Android device or emulator connected via USB and `adb` installed in your path, run the automated compile-and-install script:

```bash
chmod +x build-android.sh
./build-android.sh
```

---

### Compile Manually

If you prefer to compile manually, follow these steps:

1.  **Build the static assets**:
    ```bash
    npm run build
    ```
2.  **Sync the code to your native Capacitor Android project**:
    ```bash
    npx cap sync android
    ```
3.  **Compile and launch**:
    Open the `/android` folder in **Android Studio** to run, debug, or build a signed release APK of the app.

---

## 🔒 Security Considerations

> [!WARNING]
>**Best Practices for Secure Deployment:**
> * ShelfLife acts as a proxy server between your browser and the ABS instance. It does not implement any authentication or user management on its own. Never expose the web server directly to the internet or your ABS instance and proxy endpoint will get abused. Always put the server behind a secure reverse proxy with authentication (e.g. Cloudflare Access, Authelia, or Authelia Basic Auth) or VPN (Wireguard, Tailscale) or just host it in your local network.
> * For Android users, there is no central backend or proxy server required, as the app connects directly to the ABS instance. 
>
>**In-Browser Login (Testing & Development Only)**
>It is strongly advised to configure the connection using the server environment file. Sending login credentials directly to the browser is recommended only for testing and development, as it introduces several security risks:
> * If you host the ShelfLife proxy server over plain `http://`, all dynamic target URLs, API tokens, user login passwords, and Cloudflare Access headers configured on the connection screen will be transmitted in clear text across the network. 
> * The in-browser login screen stores your server credentials and authentication headers in the browser's `localStorage`. This is intended for development and testing only.
> * For standard server deployments, it is recommended to configure `ABS_URL` and `ABS_TOKEN` directly inside your server's `.env` file, which hides credentials completely from the web user. On Android, the credentials are stored securely on your device only.

