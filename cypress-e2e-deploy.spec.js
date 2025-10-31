// cypress/e2e/deploy.spec.js
describe('Deploy-Flow', () => {
  beforeEach(() => cy.visit('/'));

  it('Selects a repo, deploys, and downloads logs', () => {
    // 1️⃣  Log‑in (or stub)
    cy.window().then(win => {
      win.aistudio = { hasSelectedApiKey: () => Promise.resolve(true) };
    });

    // 2️⃣  Click “Select Repository” and pick one
    cy.contains('Select repository').click();
    cy.contains('my-org/my-repo').click();

    // 3️⃣  Type the deploy command
    cy.get('input[placeholder="Type a message…"]').type('deploy{enter}');

    // 4️⃣  Wait for the “success” message in the log panel
    cy.contains('Deploy: COMPLETE').should('be.visible');

    // 5️⃣  Click “Download Log”
    cy.contains('Download Log').click();

    // 6️⃣  Verify file download – requires cypress‑download‑file plugin
    cy.task('listDownloads')
      .then(files => {
        const logFile = files.find(f => f.endsWith('.log'));
        expect(logFile).to.exist;
      });
  });
});
