import styles from "./page.module.css";
import { UtilitiesHub } from "./components/UtilitiesHub";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <UtilitiesHub />
      </main>
    </div>
  );
}
