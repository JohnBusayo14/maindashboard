import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login        from './pages/Login.jsx';
import Dashboard    from './pages/Dashboard.jsx';
import Units        from './pages/Units.jsx';
import Lessons      from './pages/Lessons.jsx';
import Quizzes      from './pages/Quizzes.jsx';
import Hymns        from './pages/Hymns.jsx';
import BibleVerses  from './pages/BibleVerses.jsx';
import Banners      from './pages/Banners.jsx';
import Pricing      from './pages/Pricing.jsx';
import Subscribers  from './pages/Subscribers.jsx';
import QuarterInfo  from './pages/QuarterInfo.jsx';
import Translations from './pages/Translations.jsx';
import Leaderboard  from './pages/Leaderboard.jsx';
import Approvals    from './pages/Approvals.jsx';
import Churches     from './pages/Churches.jsx';
import Books        from './pages/Books.jsx';
import BookEntries  from './pages/BookEntries.jsx';
import VictoryMonth       from './pages/victory/VictoryMonth.jsx';
import VictoryDayEditor   from './pages/victory/VictoryDayEditor.jsx';
import VictoryVigilEditor from './pages/victory/VictoryVigilEditor.jsx';

const Guard = ({ children }) => {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index               element={<Dashboard />} />
        <Route path="units"        element={<Units />} />
        <Route path="lessons"      element={<Lessons />} />
        <Route path="quizzes"      element={<Quizzes />} />
        <Route path="hymns"        element={<Hymns />} />
        <Route path="quarter-info" element={<QuarterInfo />} />
        <Route path="translations" element={<Translations />} />
        <Route path="subscribers"  element={<Subscribers />} />
        <Route path="pricing"      element={<Pricing />} />
        <Route path="approvals"    element={<Approvals />} />
        <Route path="churches"            element={<Churches />} />
        <Route path="books"               element={<Books />} />
        <Route path="books/:bookId/entries" element={<BookEntries />} />
        <Route path="victory"             element={<VictoryMonth />} />
        <Route path="victory/day/:dayId"  element={<VictoryDayEditor />} />
        <Route path="victory/vigil/new"   element={<VictoryVigilEditor />} />
        <Route path="victory/vigil/:vigilId" element={<VictoryVigilEditor />} />
        <Route path="leaderboard"  element={<Leaderboard />} />
        <Route path="banners"      element={<Banners />} />
        <Route path="bible-verses" element={<BibleVerses />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
