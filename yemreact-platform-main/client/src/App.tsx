import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { SiteSidebar } from "./components/SiteSidebar";
import { ThemeProvider } from "./contexts/ThemeContext";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AdminOperations from "./pages/AdminOperations";
import CategoryArchive from "./pages/CategoryArchive";
import CollectionArchive from "./pages/CollectionArchive";
import Groups from "./pages/Groups";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ReactionDetail from "./pages/ReactionDetail";
import SubmitReaction from "./pages/SubmitReaction";

function Router() {
  return <Switch>{import.meta.env.DEV && <Route path="/__visual-admin" component={Admin} />}<Route path="/" component={Home} /><Route path="/groups" component={Groups} /><Route path="/r/:publicId" component={ReactionDetail} /><Route path="/category/:categoryId" component={CategoryArchive} /><Route path="/categories/:categoryId" component={CategoryArchive} /><Route path="/collection/:slug" component={CollectionArchive} /><Route path="/collections/:slug" component={CollectionArchive} /><Route path="/account" component={Account} /><Route path="/submit" component={SubmitReaction} /><Route path="/admin/operations" component={AdminOperations} /><Route path="/admin" component={Admin} /><Route component={NotFound} /></Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster /><SiteSidebar /><main className="site-main-frame"><Router /></main></TooltipProvider></ThemeProvider></ErrorBoundary>; }
