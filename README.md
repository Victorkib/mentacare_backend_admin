# MentaCare Admin Dashboard Backend

This is the backend implementation for the MentaCare Admin Dashboard, built with Node.js, Express.js, and MongoDB (Mongoose). It provides RESTful APIs for managing patients, therapists, sessions, and includes authentication and authorization features.

## Features

- **Patients Module**: CRUD operations, search/filter, view history, assign therapist, flag for special attention, upload/view documents.
- **Therapists Module**: CRUD operations, view list, assign patients, track session load, view documents.
- **Sessions Module**: CRUD operations, view upcoming/past sessions, attach notes/documents, mark attendance, cancel/reschedule.
- **Admin & Authentication**: Secure login (JWT-based), admin user roles (super_admin, admin) and permissions, refresh token mechanism.
- **RESTful APIs**: Standardized JSON responses, meaningful HTTP status codes.
- **Database**: MongoDB with Mongoose for schema definition and interaction.
- **Error Handling**: Centralized error handling.
- **Seeding**: Script to populate the database with dummy data.

## Technologies Used

- **Node.js**: JavaScript runtime.
- **Express.js**: Web application framework.
- **MongoDB**: NoSQL database.
- **Mongoose**: MongoDB object data modeling (ODM) for Node.js.
- **JWT (JSON Web Tokens)**: For secure authentication.
- **Bcrypt.js**: For password hashing.
- **CORS**: For cross-origin resource sharing.
- **Dotenv**: For managing environment variables.
- **Cookie-parser**: For parsing cookies.

## Setup and Installation

Follow these steps to get the backend running on your local machine.

### 1. Clone the Repository (if applicable)

If this backend is part of a larger project, clone the repository. Otherwise, create a new directory and place the provided files inside.

\`\`\`bash
# If you're creating a new project directory
mkdir mentacare-backend
cd mentacare-backend
# Then copy the files into this directory
\`\`\`

### 2. Install Dependencies

Navigate to the `mentacare-backend` directory and install the required Node.js packages:

\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables

Create a `.env` file in the root of the `mentacare-backend` directory. Copy the contents from the provided `.env.example` file and fill in your details.

\`\`\`
PORT=5000
MONGO_URI=mongodb://localhost:27017/mentacare # Your MongoDB connection string
JWT_SECRET=your_jwt_secret_key_here # A strong, random string for JWT signing
JWT_EXPIRES_IN=1h # e.g., 1h, 1d, 7d
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here # A strong, random string for refresh token signing
JWT_REFRESH_EXPIRES_IN=7d # e.g., 7d, 30d
\`\`\`

**Important:**
- Replace `your_jwt_secret_key_here` and `your_jwt_refresh_secret_key_here` with long, random strings. You can generate one using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- Ensure your `MONGO_URI` points to a running MongoDB instance. If you're using a local MongoDB, `mongodb://localhost:27017/mentacare` is a common default. For cloud databases like MongoDB Atlas, use your connection string provided by them.

### 4. Start MongoDB

Make sure your MongoDB server is running. If you're using a local installation, start it. If you're using a cloud service, ensure your connection string is correct and accessible.

### 5. Seed the Database (Optional but Recommended)

To populate your database with initial dummy data (admins, patients, therapists, sessions), run the seeder script:

\`\`\`bash
npm run seed
\`\`\`
This will clear any existing data in the collections and then insert the sample data.

### 6. Run the Backend Server

Start the Express server:

\`\`\`bash
npm start
\`\`\`

For development with automatic restarts on file changes, use:

\`\`\`bash
npm run dev
\`\`\`

The server will run on the port specified in your `.env` file (default: `5000`). You should see a message like `Server running on port 5000` in your console.

## API Endpoints

The API endpoints are prefixed with `/api`.

### Authentication

- `POST /api/auth/login`: Authenticate admin and get JWT token (set as http-only cookie).
- `POST /api/auth/logout`: Logout admin and clear JWT cookie.
- `POST /api/auth/refresh`: Refresh access token using refresh token (from http-only cookie).

### Admin Management (Requires `admin` or `super_admin` role)

- `POST /api/admins`: Register a new admin (Super Admin only).
- `GET /api/admins`: Get all admins.
- `GET /api/admins/:id`: Get admin by ID.
- `PUT /api/admins/:id`: Update admin details.
- `DELETE /api/admins/:id`: Delete an admin (Super Admin only).

### Patient Management (Requires `admin`, `super_admin`, or `therapist` role for GET)

- `POST /api/patients`: Create a new patient.
- `GET /api/patients`: Get all patients (supports `pageNumber` and `keyword` for search/filter).
- `GET /api/patients/:id`: Get patient by ID.
- `PUT /api/patients/:id`: Update patient details.
- `DELETE /api/patients/:id`: Delete a patient.
- `PUT /api/patients/:id/assign-therapist`: Assign a therapist to a patient.
- `PUT /api/patients/:id/flag`: Flag a patient for special attention.
- `PUT /api/patients/:id/documents`: Upload/add a document URL for a patient.

### Therapist Management (Requires `admin` or `super_admin` role)

- `POST /api/therapists`: Create a new therapist.
- `GET /api/therapists`: Get all therapists (supports `pageNumber` and `keyword`).
- `GET /api/therapists/:id`: Get therapist by ID.
- `PUT /api/therapists/:id`: Update therapist details.
- `DELETE /api/therapists/:id`: Delete a therapist.
- `PUT /api/therapists/:id/assign-patients`: Assign multiple patients to a therapist.
- `PUT /api/therapists/:id/documents`: Upload/add a document URL for a therapist.

### Session Management (Requires `admin`, `super_admin`, or `therapist` role for GET/PUT)

- `POST /api/sessions`: Create a new session.
- `GET /api/sessions`: Get all sessions (supports `pageNumber`, `status`, `patientId`, `therapistId` for filtering).
- `GET /api/sessions/:id`: Get session by ID.
- `PUT /api/sessions/:id`: Update session details.
- `DELETE /api/sessions/:id`: Delete a session.
- `PUT /api/sessions/:id/notes-attachments`: Attach notes and documents to a session.
- `PUT /api/sessions/:id/mark-attendance`: Mark session attendance.
- `PUT /api/sessions/:id/status`: Update session status (e.g., cancel, reschedule).

## API Documentation

For detailed API documentation (e.g., using Postman or Swagger), you would typically generate this from your code or manually create it. This deliverable is outside the scope of this code generation, but you can use the provided routes and controllers as a reference to build your documentation.

## Frontend Integration

- Ensure your frontend (React/Vite) is configured to make requests to `http://localhost:5000` (or whatever port your backend is running on).
- Pay attention to CORS settings. The `server.js` file includes a basic CORS configuration that allows requests from `http://localhost:5173`. Adjust `corsOptions.origin` to your actual frontend URL in production.
- For authentication, the backend sets JWTs as http-only cookies. Your frontend will not directly access these cookies but will rely on the browser sending them automatically with subsequent requests.

## Error Handling

The backend includes global error handling middleware (`notFound` and `errorHandler`) to provide consistent JSON error responses.

## Next Steps

1. **Set up your MongoDB database.**
2. **Configure your `.env` file** with your database URI and JWT secrets.
3. **Run `npm install`** to get all dependencies.
4. **Run `npm run seed`** to populate your database with initial data.
5. **Run `npm start`** (or `npm run dev`) to start the server.
6. **Integrate with your React/Vite frontend** by making API calls to these endpoints.
