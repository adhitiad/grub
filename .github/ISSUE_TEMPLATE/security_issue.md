---
name: Security Issue
about: Report a security vulnerability (use private reporting for critical issues)
title: '[SECURITY] '
labels: ['security', 'P0-critical']
assignees: ''
---

## ⚠️ Security Issue Report

**⚠️ IMPORTANT: For critical security vulnerabilities, please use GitHub's private vulnerability reporting feature instead of creating a public issue.**

## 🔒 Vulnerability Type
- [ ] Authentication bypass
- [ ] Authorization issues
- [ ] Input validation (XSS, SQL injection, etc.)
- [ ] Information disclosure
- [ ] Rate limiting bypass
- [ ] Dependency vulnerability
- [ ] Configuration issue
- [ ] Other: ___________

## 📋 Vulnerability Description
A clear and detailed description of the security issue.

## 🎯 Affected Components
- [ ] Authentication system (`src/middleware/auth.ts`)
- [ ] User management (`src/controllers/user.controller.ts`)
- [ ] Product management (`src/controllers/product.controller.ts`)
- [ ] Order processing (`src/controllers/order.controller.ts`)
- [ ] Payment processing (`src/controllers/payment.controller.ts`)
- [ ] Rate limiting (`src/middleware/deviceRateLimit.ts`)
- [ ] Input validation (`src/middleware/validation.ts`)
- [ ] Database queries (Firestore)
- [ ] Environment configuration (`src/config/env.ts`)
- [ ] Other: ___________

## 🔄 Steps to Reproduce
Detailed steps to reproduce the vulnerability:
1. 
2. 
3. 
4. 

## 💥 Impact Assessment
### Severity Level
- [ ] Critical - Complete system compromise
- [ ] High - Significant data exposure or system access
- [ ] Medium - Limited data exposure or functionality bypass
- [ ] Low - Minor information disclosure

### Potential Impact
- [ ] Data breach (user data, payment info, etc.)
- [ ] Unauthorized access to admin functions
- [ ] Service disruption
- [ ] Financial loss
- [ ] Reputation damage
- [ ] Compliance violations

## 🛡️ Affected Data Types
- [ ] User credentials (passwords, tokens)
- [ ] Personal information (names, emails, phones)
- [ ] Payment information
- [ ] Business data (orders, inventory)
- [ ] System configuration
- [ ] API keys and secrets

## 🔧 Suggested Fix
If you have suggestions for how to fix this vulnerability, please describe them here.

## 🧪 Testing Checklist
- [ ] Vulnerability confirmed in development
- [ ] Vulnerability confirmed in staging
- [ ] Impact scope identified
- [ ] Proof of concept created
- [ ] Fix tested and verified

## 🎯 Acceptance Criteria
- [ ] Vulnerability is completely fixed
- [ ] No regression in functionality
- [ ] Security tests added to prevent recurrence
- [ ] Code review completed
- [ ] Security audit passed

## 📊 CVSS Score (if applicable)
If you're familiar with CVSS scoring, please provide:
- **Base Score**: ___/10
- **Vector String**: ___________

## 🔗 References
- CVE numbers (if applicable)
- Security advisories
- Related security research

## 📅 Timeline
- **Discovery Date**: ___________
- **Disclosure Date**: ___________
- **Requested Fix Date**: ___________

## 🤝 Responsible Disclosure
- [ ] I agree to responsible disclosure practices
- [ ] I will not publicly disclose this issue until it's fixed
- [ ] I understand this may be moved to private discussion if critical

## 📞 Contact Information
If you'd like to be contacted regarding this issue:
- **Email**: ___________
- **Preferred contact method**: ___________
