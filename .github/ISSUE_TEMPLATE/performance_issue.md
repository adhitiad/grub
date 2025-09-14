---
name: Performance Issue
about: Report performance problems or optimization opportunities
title: '[PERFORMANCE] '
labels: ['performance', 'needs-triage']
assignees: ''
---

## ⚡ Performance Issue Report

## 📊 Performance Problem
A clear description of the performance issue you've identified.

## 🎯 Affected Area
- [ ] API response times
- [ ] Database queries
- [ ] Memory usage
- [ ] CPU utilization
- [ ] Network requests
- [ ] File I/O operations
- [ ] Rate limiting performance
- [ ] Search functionality
- [ ] Authentication flows
- [ ] Other: ___________

## 📋 Current Performance Metrics
### Response Times
- **Current**: _____ ms
- **Expected**: _____ ms
- **Endpoint**: ___________

### Resource Usage
- **Memory**: _____ MB
- **CPU**: _____ %
- **Database connections**: _____

### Load Characteristics
- **Concurrent users**: _____
- **Requests per second**: _____
- **Data volume**: _____

## 🔄 Steps to Reproduce
1. Set up performance monitoring
2. Execute the following operations:
   - 
   - 
   - 
3. Measure performance metrics
4. Compare with expected benchmarks

## 📈 Performance Data
```
Paste performance logs, metrics, or profiling data here
```

## 🎯 Performance Goals
- **Target response time**: _____ ms
- **Target throughput**: _____ requests/second
- **Target memory usage**: _____ MB
- **Target CPU usage**: _____ %

## 🔍 Root Cause Analysis
### Suspected Causes
- [ ] Inefficient database queries
- [ ] Missing database indexes
- [ ] Memory leaks
- [ ] Blocking I/O operations
- [ ] Inefficient algorithms
- [ ] Large payload sizes
- [ ] Network latency
- [ ] Third-party service delays

### Investigation Results
Describe your findings from performance profiling or analysis.

## 💡 Proposed Solutions
### Short-term Fixes
- [ ] Query optimization
- [ ] Caching implementation
- [ ] Index creation
- [ ] Code optimization

### Long-term Improvements
- [ ] Architecture changes
- [ ] Database optimization
- [ ] Infrastructure scaling
- [ ] Algorithm improvements

## 🧪 Testing Checklist
- [ ] Performance baseline established
- [ ] Load testing scenarios defined
- [ ] Performance monitoring set up
- [ ] Optimization implemented
- [ ] Performance improvement verified
- [ ] Regression testing completed

## 🎯 Acceptance Criteria
- [ ] Performance meets target metrics
- [ ] No functional regression
- [ ] Performance tests added to CI/CD
- [ ] Monitoring alerts configured
- [ ] Documentation updated

## 📊 Success Metrics
- **Response time improvement**: _____ % faster
- **Throughput improvement**: _____ % more requests/second
- **Resource usage reduction**: _____ % less memory/CPU
- **User experience improvement**: _____ % better satisfaction

## 🏷️ Priority
- [ ] P0 - Critical (System unusable, major user impact)
- [ ] P1 - High (Significant performance degradation)
- [ ] P2 - Medium (Noticeable but manageable impact)
- [ ] P3 - Low (Minor optimization opportunity)

## 🔧 Technical Details
### Environment
- **Node.js version**: _____
- **Database**: Firebase Firestore
- **Server specs**: _____
- **Load balancer**: _____

### Affected Code Areas
- **Controllers**: _____
- **Middleware**: _____
- **Database queries**: _____
- **External APIs**: _____

## 📅 Timeline
- **Issue discovered**: _____
- **Performance impact started**: _____
- **Target fix date**: _____
- **Estimated effort**: _____

## 🔗 Related Issues
Link any related performance issues or optimization tasks.

## 📸 Performance Graphs
If available, attach performance graphs, flame graphs, or monitoring screenshots.
