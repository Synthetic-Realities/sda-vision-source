import { CodeXml, BookOpen, UsersRound } from "lucide-react";
import type { Presentation } from "../community";

const choices = [
  { value: "community", label: "Community Workshop", Icon: UsersRound },
  { value: "facilitator", label: "Facilitator guide", Icon: BookOpen },
  { value: "developer", label: "Developer", Icon: CodeXml },
] as const;

export default function PresentationSwitcher({ value, onChange, disabled }: {
  value: Presentation; onChange: (value: Presentation) => void; disabled: boolean;
}) {
  return <div className="presentation-navigation"><fieldset className="presentation-switcher" disabled={disabled}>
    <legend className="sr-only">App view</legend>
    {choices.map(({ value: key, label, Icon }) => <label key={key} className={value === key ? "selected" : ""}>
      <input type="radio" name="sda-presentation" value={key} checked={value === key} onChange={() => onChange(key)} />
      <Icon size={19} aria-hidden="true" /><span>{label}</span>
    </label>)}
  </fieldset><div className="partner-logos" aria-label="Affiliation and funding: Manchester Metropolitan University, Smart Data Research UK and UK Research and Innovation">
      <img src="./branding/mmu-logo.png" alt="Manchester Metropolitan University" className="partner-mmu" />
      <img src="./branding/sdruk-logo.png" alt="Smart Data Research UK" className="partner-sdruk" />
      <img src="./branding/ukri-logo.png" alt="UK Research and Innovation" className="partner-ukri" />
    </div></div>;
}
