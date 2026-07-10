Bounty Hunter
Bounty Hunter is a sophisticated live lead intelligence application that provides real-time lead scraping, MX-validated contact extraction, and AI-generated business proposals. This app is powered by Jina AI and Lovable Cloud and offers seamless syncing of data to your Lovable Cloud database with live status updates.

Features
Jina AI Search: Conducts live keyword scraping across multiple platforms including the web, LinkedIn, Facebook, and Instagram.
MX Validation: Validates extracted emails through real DNS-over-HTTPS MX checks to ensure contact accuracy.
Live Sync: Uses Supabase Realtime to instantly push status updates to the user interface.
AI Proposal Generation: Automatically generates business proposals based on the scraped lead data.
Responsive UI: Built with React and various Radix UI components for a modern and accessible user experience.
Authentication: Integrated Supabase authentication system to secure user access.
Tech Stack
React 19
Tanstack Router & React Query
Supabase for real-time backend and auth
Tailwind CSS for styling
Jina AI for lead scraping and AI capabilities
Lovable Cloud for database syncing and error reporting
TypeScript for type safety
Getting Started
Prerequisites
Node.js and Bun runtime installed
Access to Supabase project with environment variables set
Necessary API keys and credentials for Jina AI and Lovable Cloud
Installation
Clone the repo:
git clone https://github.com/sunisajantalok78-blip/bounty-bard-21.git
Install dependencies using Bun:
bun install
Configure environment variables by copying .env.example to .env and filling in necessary values (API keys, Supabase URL, etc.).
Running the App
Run the development server with:

bun run dev
The app will be available in your browser at http://localhost:3000.

Project Structure
src/ - Main source code including:
routes/ - Route components with Tanstack Router setup
components/ - UI components
integrations/ - External integrations like Supabase auth attacher
lib/ - Utilities like error page rendering and error reporting
server.ts and start.ts - App server and middleware setup
package.json - Project metadata and dependencies
vite.config.ts - Vite configuration for bundling
tsconfig.json - TypeScript configuration
Error Handling
Custom middleware captures server errors and returns a friendly error page. Errors are logged to the console and reported to Lovable Cloud for monitoring.

License
This project is private.

Contact
For more information or support, please reach out to the repository owner at sunisajantalok78-blip.

Enjoy using Bounty Hunter, your live intelligence companion!
