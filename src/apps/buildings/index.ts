import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

import "../../structure/ngv-structure-app.js";
import { INgvStructureApp } from "../../structure/ngv-structure-app.js";

// @ts-expect-error ?url parameter is a viteJS specificity
import logoUrl from "../../logo.svg?url";

@customElement("ngv-app-buildings")
export class NgvAppBuildings extends LitElement {
  @state()
  ngvStructureAppConfig: INgvStructureApp;

  constructor() {
    super();
    // this.shadowRoot.adoptedStyleSheets.push(styles);
  }

  protected firstUpdated(): void {
    // simulate retrieving config from an external config file
    setTimeout(() => {
      this.ngvStructureAppConfig = {
        header: {
          languages: ["fr", "en", "it", "de"],
          logo: logoUrl as string,
          title: {
            fr: "Ma super app",
            en: "My super app",
            de: "Meine supper app",
            it: "Mia super app",
          },
        },
        footer: {
          contact: "me@example.com",
          impressum: {
            fr: "Bla bla FR impressim",
            en: "Bla bla EN impressim",
            de: "Bla bla DE impressim",
            it: "Bla bla IT impressim",
          },
        },
      };
    }, 200);
  }

  render() {
    return html`
      <ngv-structure-app .config=${this.ngvStructureAppConfig}>
        THIS IS A CRAZY BUILDINGS app
      </ngv-structure-app>
    `;
  }
}
