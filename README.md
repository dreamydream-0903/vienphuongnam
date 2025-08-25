<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

<br />
<div align="center">
  <a href="https://github.com/thaingocthienlong/secure-streaming-platform">
    <!-- You can add a logo here if you have one -->
    <!-- <img src="images/logo.png" alt="Logo" width="80" height="80"> -->
  </a>

  <h3 align="center">Secure Streaming Platform</h3>

  <p align="center">
    A full-stack Next.js application providing secure, encrypted video streaming with raw-key DRM.  
    Includes Google OAuth authentication, Prisma + PostgreSQL backend, Cloudflare R2 storage, and a unified proxy for streaming license delivery.
    <br />
    <a href="https://github.com/thaingocthienlong/secure-streaming-platform"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/thaingocthienlong/secure-streaming-platform/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/thaingocthienlong/secure-streaming-platform/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#key-features">Key Features</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#logic-and-data-flow">Logic and Data Flow</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

This repository contains the full-stack **Secure Streaming Platform**, built with Next.js and TypeScript. It provides:

* **Google OAuth authentication** via NextAuth.js
* **Admin dashboard** for managing courses, videos, users, and enrollments
* **Encrypted DASH/HLS streaming** from Cloudflare R2 with raw-key (clearkey) DRM
* **Playback token & license** endpoints to ensure only authorized users can view content
* A **unified proxy** API route that signs and streams encrypted files, hiding R2 URLs

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Key Features

* **OAuth-only Sign-in**: Secure Google login with sessions stored in JWTs.
* **Prisma + PostgreSQL**: All data stored via Prisma ORM in a scalable Postgres database.
* **Cloudflare R2 Integration**: Encrypted assets stored in R2, served via signed URLs.
* **DRM License Server**: `/api/drm/clearkey` returns raw-key licenses after verifying playback tokens.
* **Playback Tokens**: Short-lived JWTs issued by `/api/get-playback-token` to gate content.
* **Unified Streaming Proxy**: `pages/api/stream/[...path].ts` verifies tokens and proxies byte-ranges.
* **Admin UI**: React pages under `/pages/admin` for creating and editing courses, videos, users, and enrollments.
* **ReCAPTCHA**: Protects sensitive endpoints (e.g. login links).
* **Analytics Hooks**: Mux and Mixpanel integration on the client side.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Next][Next.js]][Next-url]
* [![React][React.js]][React-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![Prisma][Prisma]][Prisma-url]
* [![PostgreSQL][PostgreSQL]][PostgreSQL-url]
* [![NextAuth.js][NextAuth]][NextAuth-url]
* [![Cloudflare R2][CloudflareR2]][CloudflareR2-url]
* [![Shaka Player][ShakaPlayer]][ShakaPlayer-url]
* [![Material-UI & Tailwind CSS][MuiTailwind]][MuiTailwind-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LOGIC AND DATA FLOW -->

## Logic and Data Flow

### 1. Authentication Flow (OAuth via NextAuth.js)

1. **User visits** `/api/auth/signin` and chooses Google.
2. **NextAuth** redirects to Google, handles the callback, and issues a session JWT.
3. **Client** uses NextAuth’s `useSession()` to access user info.

### 2. Admin Management Flow

1. **Admin pages** under `/pages/admin` are protected by a role check (`isAdmin` flag in the User model).
2. **CRUD operations** for Users, Enrollments, Courses, and Course Videos hit `/api/admin/...` endpoints.
3. **Prisma** executes corresponding database queries.

### 3. Secure Playback & License Flow

1. **Client** calls `/api/get-playback-token?courseCode=<>&videoId=<>` with session cookie.
2. **Server** verifies session, checks enrollment in the database, then returns a short-lived playback JWT.
3. **Shaka Player** requests the license at `/api/drm/clearkey`, sending the playback JWT.
4. **Server** verifies the JWT and returns the raw-key license JSON.
5. **Video segments** are fetched via `/api/stream/[...path]`, which validates the same JWT, generates a signed R2 URL, and proxies the requested byte-range.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

Follow these steps to run the platform locally.

### Prerequisites

* **Node.js** ≥ v16
* **npm** (or yarn/pnpm)
* A **PostgreSQL** database
* (Optional) A Cloudflare R2 bucket and Upstash Redis instance

### Installation

1. **Clone the repo**

   ```bash
   git clone https://github.com/thaingocthienlong/secure-streaming-platform.git
   cd secure-streaming-platform
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   Copy `.env` to `.env.local` and fill in your own values (Google OAuth, database URLs, R2 keys, Redis URL, JWT secrets, etc.).

4. **Run development server**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

* [x] Google OAuth sign-in (NextAuth)
* [x] Prisma + PostgreSQL integration
* [x] Admin dashboard (Courses, Videos, Users, Enrollments)
* [x] Cloudflare R2 encrypted storage
* [x] Playback tokens & clearkey license endpoints
* [x] Unified streaming proxy route
* [ ] Email/password registration & credentials login
* [ ] Real-time notifications (WebSockets)
* [ ] Client analytics (Mux / Mixpanel)
* [ ] UI/UX polish & accessibility enhancements

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are **greatly appreciated**!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to your branch (`git push origin feature/YourFeature`)
5. Open a pull request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Thái Ngọc Thiên Long
Email: [thaingocthienlong@gmail.com](mailto:thaingocthienlong@gmail.com)
SĐT/Zalo: 0396 291 932

Project Link: [https://github.com/thaingocthienlong/secure-streaming-platform](https://github.com/thaingocthienlong/secure-streaming-platform)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/thaingocthienlong/secure-streaming-platform.svg?style=for-the-badge
[contributors-url]: https://github.com/thaingocthienlong/secure-streaming-platform/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/thaingocthienlong/secure-streaming-platform.svg?style=for-the-badge
[forks-url]: https://github.com/thaingocthienlong/secure-streaming-platform/network/members
[stars-shield]: https://img.shields.io/github/stars/thaingocthienlong/secure-streaming-platform.svg?style=for-the-badge
[stars-url]: https://github.com/thaingocthienlong/secure-streaming-platform/stargazers
[issues-shield]: https://img.shields.io/github/issues/thaingocthienlong/secure-streaming-platform.svg?style=for-the-badge
[issues-url]: https://github.com/thaingocthienlong/secure-streaming-platform/issues
[PostgreSQL]: https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white
[contributors-shield]: https://img.shields.io/github/contributors/github_username/repo_name.svg?style=for-the-badge
[contributors-url]: https://github.com/github_username/repo_name/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/github_username/repo_name.svg?style=for-the-badge
[forks-url]: https://github.com/github_username/repo_name/network/members
[stars-shield]: https://img.shields.io/github/stars/github_username/repo_name.svg?style=for-the-badge
[stars-url]: https://github.com/github_username/repo_name/stargazers
[issues-shield]: https://img.shields.io/github/issues/github_username/repo_name.svg?style=for-the-badge
[issues-url]: https://github.com/github_username/repo_name/issues
[license-shield]: https://img.shields.io/github/license/github_username/repo_name.svg?style=for-the-badge
[license-url]: https://github.com/github_username/repo_name/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/linkedin_username
[product-screenshot]: images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/

[Prisma]: https://img.shields.io/badge/Prisma-5A20C0?style=for-the-badge&logo=prisma&logoColor=white
[Prisma-url]: https://www.prisma.io/
[PostgreSQL]: https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white
[PostgreSQL-url]: https://www.postgresql.org/
[NextAuth]: https://img.shields.io/badge/NextAuth.js-2F80ED?style=for-the-badge&logo=nextdotjs&logoColor=white
[NextAuth-url]: https://next-auth.js.org/
[CloudflareR2]: https://img.shields.io/badge/Cloudflare_R2-F38020?style=for-the-badge&logo=cloudflare&logoColor=white
[CloudflareR2-url]: https://www.cloudflare.com/products/r2/
[ShakaPlayer]: https://img.shields.io/badge/Shaka_Player-007ACC?style=for-the-badge&logo=googlechrome&logoColor=white
[ShakaPlayer-url]: https://shaka-player-demo.appspot.com/
[MuiTailwind]: https://img.shields.io/badge/Material--UI%20%26%20Tailwind_CSS-007ACC?style=for-the-badge&logo=material-ui&logoColor=white
[MuiTailwind-url]: https://mui.com/
[TypeScript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/# vienphuongnam
