import guideContent from "../facilitator-guide.html?raw";
import "../facilitator-guide.css";

// Trusted, repository-owned markup shared with the directly linked guide page.
// No visitor entries or provider replies are inserted into this content.
export default function FacilitatorGuide() {
  return <main className="facilitator-guide" dangerouslySetInnerHTML={{ __html: guideContent }} />;
}
