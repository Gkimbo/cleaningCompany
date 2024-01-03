<div align="center">

# Airbnb Sparkle ![NPM version](https://img.shields.io/badge/npm-v16.18.0-blue)

Airbnb Sparkle is your go-to cleaning service dedicated to making your short-term rental properties shine. Our website and app offer a hassle-free experience, allowing hosts to schedule cleanings, manage turnovers, and ensure a sparkling first impression for every guest.

</div>
<div align="left">

- [🌟 Services](#-services)
- [🧹 Tailored Cleanings](#-tailored-cleanings)
- [🌐 Technologies](#-technologies)

## 🌟 Services

We specialize in providing top-notch cleaning services tailored for short-term rental properties:

- Check-In/Check-Out Turnovers
- Linen and Towel Refresh
- Deep Cleaning Between Guests
- Flexible Scheduling

## 🧹 Tailored Cleanings

Airbnb Sparkle understands the unique needs of short-term rentals. We offer flexible cleaning schedules to accommodate your booking calendar, ensuring a spotless space for each new guest. Our attention to detail enhances your property's appeal, leading to positive reviews and repeat bookings.

## 🌐 Technologies

To guarantee a seamless experience, we leverage the following technologies:

- React Native
- Node.js
- Express
- PostgreSQL
- Sequelize
- React Native Paper

### 🌱 Install

Getting started with Airbnb Sparkle is quick and easy:

1. Install [Git](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup) if you don't have it.

2. Install [PostgreSQL](https://www.postgresql.org/download/).

3. Clone the repository:

```bash
git clone https://github.com/AirbnbSparkle/sparkle-clean.git
```

Install dependencies:

```bash
cd sparkle-clean
npm install
```

Create the database:

```bash
createdb cleaning_company_development
```

Run migrations:

```bash
npx sequelize-cli db:migrate
```

Create a .env file in the server directory:

```bash
cd server
touch .env
```

Copy keys from the .env.example file and add your API keys.
Launch the app:

```bash
cd client
npm start
w
```

In a different terminal tab:

```bash

cd server
npm start
```

Navigate to http://localhost:3000 in your browser to ensure everything is set up.
If you'd like to contribute:

Follow the 'Install' instructions to clone the repository.
Create a new git branch for refactoring or implementing new features.
Send a pull request for review and consideration of merging into the main application branch.

</div>
