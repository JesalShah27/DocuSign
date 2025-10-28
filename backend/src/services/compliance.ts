// Compliance and legal notices for electronic signatures

export interface ComplianceInfo {
  jurisdiction: string;
  applicableLaws: string[];
  consentText: string;
  legalNotice: string;
  dataRetention: string;
  privacyPolicy: string;
}

export const COMPLIANCE_NOTICES: Record<string, ComplianceInfo> = {
  US: {
    jurisdiction: 'United States',
    applicableLaws: [
      'Electronic Signatures in Global and National Commerce Act (ESIGN)',
      'Uniform Electronic Transactions Act (UETA)',
      'State-specific electronic signature laws'
    ],
    consentText: 'By signing this document electronically, you consent to the use of electronic records and signatures in accordance with the Electronic Signatures in Global and National Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA). You understand that your electronic signature has the same legal effect as a handwritten signature.',
    legalNotice: 'This document has been electronically signed in compliance with applicable federal and state laws. Electronic signatures are legally binding and enforceable in the same manner as handwritten signatures.',
    dataRetention: 'Signing records and audit trails will be retained for a minimum of 7 years in accordance with applicable legal requirements.',
    privacyPolicy: 'Personal information collected during the signing process is used solely for the purpose of document execution and will be protected in accordance with our privacy policy and applicable data protection laws.'
  },
  EU: {
    jurisdiction: 'European Union',
    applicableLaws: [
      'eIDAS Regulation (EU) 910/2014',
      'General Data Protection Regulation (GDPR)',
      'Directive 1999/93/EC on electronic signatures'
    ],
    consentText: 'By signing this document electronically, you consent to the use of electronic records and signatures in accordance with the eIDAS Regulation (EU) 910/2014. You understand that your electronic signature has the same legal effect as a handwritten signature under EU law.',
    legalNotice: 'This document has been electronically signed in compliance with the eIDAS Regulation and applicable EU member state laws. Electronic signatures are legally binding and enforceable throughout the European Union.',
    dataRetention: 'Signing records and audit trails will be retained in accordance with GDPR requirements and applicable legal retention periods.',
    privacyPolicy: 'Personal data processing is conducted in accordance with the General Data Protection Regulation (GDPR). You have the right to access, rectify, erase, and port your personal data as provided under GDPR.'
  },
  IN: {
    jurisdiction: 'India',
    applicableLaws: [
      'Information Technology Act, 2000',
      'Information Technology (Certifying Authorities) Rules, 2000',
      'Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011'
    ],
    consentText: 'By signing this document electronically, you consent to the use of electronic records and signatures in accordance with the Information Technology Act, 2000. You understand that your electronic signature has the same legal effect as a handwritten signature under Indian law.',
    legalNotice: 'This document has been electronically signed in compliance with the Information Technology Act, 2000 and applicable Indian laws. Electronic signatures are legally binding and enforceable in India.',
    dataRetention: 'Signing records and audit trails will be retained in accordance with applicable Indian legal requirements and data protection regulations.',
    privacyPolicy: 'Personal information is processed in accordance with the Information Technology Act, 2000 and related rules. You have rights regarding your personal data as provided under applicable Indian laws.'
  }
};

export function getComplianceInfo(jurisdiction: string = 'US'): ComplianceInfo {
  return (COMPLIANCE_NOTICES[jurisdiction] || COMPLIANCE_NOTICES['US']) as ComplianceInfo;
}

export function generateConsentText(jurisdiction: string = 'US'): string {
  const compliance = getComplianceInfo(jurisdiction);
  return compliance.consentText;
}

export function generateLegalNotice(jurisdiction: string = 'US'): string {
  const compliance = getComplianceInfo(jurisdiction);
  return compliance.legalNotice;
}

export function validateComplianceRequirements(
  signerCountry?: string,
  documentType?: string,
  businessType?: string
): { compliant: boolean; requirements: string[]; warnings: string[] } {
  const requirements: string[] = [];
  const warnings: string[] = [];
  
  // Basic compliance requirements
  requirements.push('Electronic signature consent must be obtained');
  requirements.push('Audit trail must be maintained');
  requirements.push('Document integrity must be preserved');
  
  // Jurisdiction-specific requirements
  if (signerCountry === 'US') {
    requirements.push('ESIGN Act compliance required');
    requirements.push('UETA compliance required');
  } else if (signerCountry === 'EU') {
    requirements.push('eIDAS Regulation compliance required');
    requirements.push('GDPR compliance required');
    warnings.push('Consider using qualified electronic signatures for highest legal certainty');
  } else if (signerCountry === 'IN') {
    requirements.push('Information Technology Act compliance required');
    requirements.push('Digital signature certificate recommended for certain documents');
  }
  
  // Document type specific requirements
  if (documentType === 'contract') {
    requirements.push('Contract formation requirements must be met');
    requirements.push('Consideration must be clearly stated');
  } else if (documentType === 'legal') {
    requirements.push('Legal document requirements must be met');
    warnings.push('Consider legal review for complex legal documents');
  }
  
  // Business type specific requirements
  if (businessType === 'financial') {
    requirements.push('Financial services regulations compliance required');
    warnings.push('Additional verification may be required for financial documents');
  } else if (businessType === 'healthcare') {
    requirements.push('HIPAA compliance required (US)');
    requirements.push('Healthcare data protection requirements must be met');
  }
  
  return {
    compliant: requirements.length > 0,
    requirements,
    warnings
  };
}

export function generateComplianceReport(
  envelopeId: string,
  signers: Array<{ name: string; email: string; country?: string }>,
  documentType: string = 'general',
  businessType: string = 'general'
): string {
  const report = [];
  
  report.push('COMPLIANCE REPORT');
  report.push('================');
  report.push(`Envelope ID: ${envelopeId}`);
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  
  // Signer information
  report.push('SIGNERS:');
  signers.forEach((signer, index) => {
    report.push(`${index + 1}. ${signer.name} (${signer.email})`);
    if (signer.country) {
      report.push(`   Country: ${signer.country}`);
    }
  });
  report.push('');
  
  // Compliance validation
  const validation = validateComplianceRequirements(
    signers[0]?.country,
    documentType,
    businessType
  );
  
  report.push('COMPLIANCE REQUIREMENTS:');
  validation.requirements.forEach(req => {
    report.push(`✓ ${req}`);
  });
  report.push('');
  
  if (validation.warnings.length > 0) {
    report.push('WARNINGS:');
    validation.warnings.forEach(warning => {
      report.push(`⚠ ${warning}`);
    });
    report.push('');
  }
  
  // Legal notices
  const jurisdiction = signers[0]?.country || 'US';
  const compliance = getComplianceInfo(jurisdiction);
  
  report.push('APPLICABLE LAWS:');
  compliance.applicableLaws.forEach(law => {
    report.push(`• ${law}`);
  });
  report.push('');
  
  report.push('LEGAL NOTICE:');
  report.push(compliance.legalNotice);
  report.push('');
  
  report.push('DATA RETENTION:');
  report.push(compliance.dataRetention);
  report.push('');
  
  report.push('PRIVACY POLICY:');
  report.push(compliance.privacyPolicy);
  
  return report.join('\n');
}
