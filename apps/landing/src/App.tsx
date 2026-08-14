import { Nav } from "./components/Nav";
import { Hero } from "./sections/Hero";
import { Problems } from "./sections/Problems";
import { ChatCard } from "./sections/ChatCard";
import { HowItWorks } from "./sections/HowItWorks";
import { Presence } from "./sections/Presence";
import { Split } from "./sections/Split";
import { Karma } from "./sections/Karma";
import { Closing } from "./sections/Closing";

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problems />
        <ChatCard />
        <HowItWorks />
        <Presence />
        <Split />
        <Karma />
      </main>
      <Closing />
    </>
  );
}
