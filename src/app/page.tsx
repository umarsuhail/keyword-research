import styles from "./page.module.css";
import { HtmlSearchApp } from "./components/HtmlSearchApp";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <HtmlSearchApp />
      </main>
    </div>
  );
}
