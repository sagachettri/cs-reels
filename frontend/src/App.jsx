import { Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import GuestRoute from './components/GuestRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Categories from './pages/Categories';
import Category from './pages/Category';
import Search from './pages/Search';
import Saved from './pages/Saved';
import Liked from './pages/Liked';
import Profile from './pages/Profile';
import ReelDetail from './pages/ReelDetail';
import Chatbot from './pages/Chatbot';
import NotFound from './pages/NotFound';
import Dashboard from './pages/admin/Dashboard';
import UploadReel from './pages/admin/UploadReel';
import ManageContent from './pages/admin/ManageContent';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:slug" element={<Category />} />
        <Route path="/search" element={<Search />} />
        <Route path="/reels/:id" element={<ReelDetail />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/saved" element={<Saved />} />
          <Route path="/liked" element={<Liked />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chatbot />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/upload" element={<UploadReel />} />
            <Route path="/admin/reels" element={<ManageContent />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
