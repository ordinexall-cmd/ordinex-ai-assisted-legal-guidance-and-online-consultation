import React from 'react';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';
import { LICENSES_DOCUMENT } from '../content/legalDocuments';

export const LicensesPage: React.FC = () => (
  <LegalDocumentPage doc={LICENSES_DOCUMENT} activePath="/licenses" />
);

export default LicensesPage;
