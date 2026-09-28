import { useState } from "react";
import { Button } from "@maxhub/max-ui";
import { RoleMark } from "./RoleMark";
import { ONBOARDING_SLIDES, markOnboardingSeen } from "../lib/onboarding";

function ArtLevel() {
  return (
    <div className="onboard-art-levels" aria-hidden="true">
      <span>Новичок</span>
      <span className="is-on">Любитель</span>
      <span>Продвинутый</span>
    </div>
  );
}

function ArtSlot() {
  return (
    <div className="onboard-art-slots" aria-hidden="true">
      {(
        [
          { role: "Вратарь", label: "вратарь", needed: true },
          { role: "Защитник", label: "защитник", needed: true },
          { role: "Нападающий", label: "нападающий", needed: true },
          { role: null, label: "любой", needed: false },
        ] as const
      ).map((item) => (
        <span key={item.label} className="onboard-slot">
          <span className={item.needed ? "slot is-needed" : "slot"}>
            <RoleMark role={item.role} />
          </span>
          <small>{item.label}</small>
        </span>
      ))}
    </div>
  );
}

function ArtReliability() {
  return (
    <div className="onboard-art-karma" aria-hidden="true">
      <strong>96%</strong>
      <small>надёжность</small>
    </div>
  );
}

const ART = [ArtLevel, ArtSlot, ArtReliability];

export function Onboarding({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const last = index === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[index]!;
  const Art = ART[index]!;

  function finish() {
    markOnboardingSeen();
    onClose();
  }

  function next() {
    if (last) finish();
    else setIndex((value) => value + 1);
  }

  return (
    <div
      className="onboard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-title"
    >
      <div className="onboard-art">
        <Art />
      </div>
      <h2 id="onboard-title" className="onboard-title">
        {slide.title}
      </h2>
      <p className="onboard-text">{slide.text}</p>
      <div className="onboard-dots" aria-hidden="true">
        {ONBOARDING_SLIDES.map((item, dot) => (
          <span key={item.id} className={dot === index ? "is-on" : undefined} />
        ))}
      </div>
      <div className="onboard-actions">
        <Button stretched onClick={next}>
          {last ? "Понятно" : "Дальше"}
        </Button>
        {!last && (
          <button type="button" className="onboard-skip" onClick={finish}>
            Пропустить
          </button>
        )}
      </div>
    </div>
  );
}
