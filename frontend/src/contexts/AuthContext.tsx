import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signOut as firebaseSignOut } from '../lib/firebase';
import api from '../services/api';

// Database user from MongoDB
export interface DbUser {
  _id: string;
  firebase_uid: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  role: 'admin' | 'editor' | 'viewer';
  preferences: {
    language: 'en' | 'he';
    theme: 'dark' | 'light';
    notifications: {
      email_enabled: boolean;
      push_enabled: boolean;
      sms_enabled: boolean;
    };
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string;
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  role: 'admin' | 'editor' | 'viewer' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data from MongoDB
  const fetchDbUser = async () => {
    try {
      const userData = await api.getCurrentUser();
      setDbUser(userData);
    } catch (error) {
      console.error('Failed to fetch user from API:', error);
      setDbUser(null);
    }
  };

  // Refresh user data (can be called after profile updates)
  const refreshUser = async () => {
    if (user) {
      await fetchDbUser();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // User signed in - fetch/create user in database
        await fetchDbUser();
      } else {
        // User signed out - clear database user
        setDbUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Get role from database user
  const role = dbUser?.role ?? null;

  const signOut = async () => {
    await firebaseSignOut();
    setDbUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, role, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
