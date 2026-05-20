import { subDays, startOfHour, format } from "date-fns";
import { User, Library, Session, Book, UserStats } from "./types";

export const MOCK_USERS: User[] = [
  { id: "u1", username: "alex_listener", type: "admin" },
  { id: "u2", username: "bookworm_sarah", type: "user" },
  { id: "u3", username: "audiophile_mike", type: "user" },
  { id: "u4", username: "emily_reads", type: "guest" },
  { id: "u5", username: "david_h", type: "user" },
];

export const MOCK_LIBRARIES: Library[] = [
  { id: "lib1", name: "Main Fiction", type: "book" },
  { id: "lib2", name: "Non-Fiction & Science", type: "book" },
  { id: "lib3", name: "Podcasts & Radio", type: "podcast" },
];

const BOOKS_DATA = [
  { title: "Project Hail Mary", author: "Andy Weir" },
  { title: "The Martian", author: "Andy Weir" },
  { title: "Dune", author: "Frank Herbert" },
  { title: "1984", author: "George Orwell" },
  { title: "The Seven Husbands of Evelyn Hugo", author: "Taylor Jenkins Reid" },
  { title: "Sapiens", author: "Yuval Noah Harari" },
  { title: "Atomic Habits", author: "James Clear" },
  { title: "The Midnight Library", author: "Matt Haig" },
  { title: "Circe", author: "Madeline Miller" },
  { title: "The Hobbit", author: "J.R.R. Tolkien" },
];

export const MOCK_BOOKS: Book[] = BOOKS_DATA.map((b, i) => ({
  id: `b${i + 1}`,
  libraryId: i % 2 === 0 ? "lib1" : "lib2",
  metadata: {
    title: b.title,
    authorName: b.author,
    coverPath: `https://picsum.photos/seed/${b.title.replace(/\s/g, "")}/300/450`,
  },
  addedAt: subDays(new Date(), Math.floor(Math.random() * 60)).getTime(),
}));

// Generate a month of sessions
const generateSessions = (): Session[] => {
  const sessions: Session[] = [];
  const now = new Date();
  
  for (let i = 0; i < 30; i++) {
    const date = subDays(now, i);
    MOCK_USERS.forEach(user => {
      // Each user has a 70% chance of listening each day
      if (Math.random() > 0.3) {
        const sessionCount = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < sessionCount; j++) {
          const book = MOCK_BOOKS[Math.floor(Math.random() * MOCK_BOOKS.length)];
          const duration = Math.floor(Math.random() * 7200) + 1800; // 30 mins to 2.5 hours
          const hour = Math.floor(Math.random() * 14) + 8; // Between 8 AM and 10 PM
          const startedAt = new Date(date);
          startedAt.setHours(hour, Math.floor(Math.random() * 60));
          
          sessions.push({
            id: `s_${user.id}_${i}_${j}`,
            userId: user.id,
            username: user.username,
            libraryId: book.libraryId,
            duration,
            timeListening: duration,
            startedAt: startedAt.getTime(),
            mediaItemTitle: book.metadata.title,
            progress: parseFloat((Math.random() * 0.9 + 0.1).toFixed(2)),
          });
        }
      }
    });
  }
  return sessions;
};

export const MOCK_SESSIONS: Session[] = generateSessions();

export const MOCK_ACTIVE_SESSIONS: Session[] = [
  {
    id: "active1",
    userId: "u1",
    username: "alex_listener",
    libraryId: "lib1",
    duration: 3600,
    timeListening: 3600,
    startedAt: Date.now() - 3600000,
    currentTime: 2450,
    progress: 0.68,
    isActive: true,
    mediaItemTitle: "Project Hail Mary",
  },
  {
    id: "active2",
    userId: "u2",
    username: "bookworm_sarah",
    libraryId: "lib2",
    duration: 1800,
    timeListening: 1800,
    startedAt: Date.now() - 1800000,
    currentTime: 450,
    progress: 0.25,
    isActive: true,
    mediaItemTitle: "Atomic Habits",
  }
];
