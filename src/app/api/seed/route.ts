import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { simpleHash } from '@/lib/geo';

export async function POST() {
  try {
    const existingUsers = await db.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({ message: 'Database already seeded', count: existingUsers });
    }

    // Create departments first
    const deptCS = await db.department.create({ data: { name: 'Computer Science', code: 'CS', description: 'Department of Computer Science & Engineering' } });
    const deptIS = await db.department.create({ data: { name: 'Information Science', code: 'IS', description: 'Department of Information Science & Engineering' } });
    const deptEC = await db.department.create({ data: { name: 'Electronics', code: 'EC', description: 'Department of Electronics & Communication' } });
    const deptME = await db.department.create({ data: { name: 'Mechanical', code: 'ME', description: 'Department of Mechanical Engineering' } });
    const deptCV = await db.department.create({ data: { name: 'Civil', code: 'CV', description: 'Department of Civil Engineering' } });

    const admin = await db.user.create({ data: { name: 'Dr. Ramesh Kumar', email: 'admin@vvce.ac.in', passwordHash: simpleHash('admin123'), role: 'ADMIN', phone: '9876543210', approvalStatus: 'APPROVED' } });
    const hod1 = await db.user.create({ data: { name: 'Dr. Kavitha Raj', email: 'hod.cs@vvce.ac.in', passwordHash: simpleHash('demo123'), role: 'HOD', departmentId: deptCS.id, phone: '9876543216', approvalStatus: 'APPROVED' } });
    const hod2 = await db.user.create({ data: { name: 'Dr. Suresh Bhat', email: 'hod.ec@vvce.ac.in', passwordHash: simpleHash('demo123'), role: 'HOD', departmentId: deptEC.id, phone: '9876543217', approvalStatus: 'APPROVED' } });
    const faculty1 = await db.user.create({ data: { name: 'Dr. Priya Sharma', email: 'priya.sharma@vvce.ac.in', passwordHash: simpleHash('faculty123'), role: 'FACULTY', departmentId: deptCS.id, phone: '9876543211', approvalStatus: 'APPROVED' } });
    const faculty2 = await db.user.create({ data: { name: 'Prof. Anil Desai', email: 'anil.desai@vvce.ac.in', passwordHash: simpleHash('faculty123'), role: 'FACULTY', departmentId: deptEC.id, phone: '9876543212', approvalStatus: 'APPROVED' } });
    // Former organizers are now STUDENTs with club Event Coordinator permissions
    const org1 = await db.user.create({ data: { name: 'Rahul Gowda', email: 'rahul.gowda@vvce.ac.in', passwordHash: simpleHash('demo123'), role: 'STUDENT', departmentId: deptCS.id, usn: '4VV21CS001', phone: '9876543213', approvalStatus: 'APPROVED' } });
    const org2 = await db.user.create({ data: { name: 'Sneha Rao', email: 'sneha.rao@vvce.ac.in', passwordHash: simpleHash('demo123'), role: 'STUDENT', departmentId: deptIS.id, usn: '4VV21IS002', phone: '9876543214', approvalStatus: 'APPROVED' } });
    const org3 = await db.user.create({ data: { name: 'Vikram M', email: 'vikram.m@vvce.ac.in', passwordHash: simpleHash('demo123'), role: 'STUDENT', departmentId: deptME.id, usn: '4VV21ME003', phone: '9876543215', approvalStatus: 'APPROVED' } });

    // Update departments with HOD
    await db.department.update({ where: { id: deptCS.id }, data: { hodId: hod1.id } });
    await db.department.update({ where: { id: deptEC.id }, data: { hodId: hod2.id } });

    const students: any[] = [];
    const studentNames = ['Aditi N','Bharath K','Chitra R','Deepak S','Esha P','Farhan A','Geetha L','Harsha V','Ishaan B','Jaya S','Kiran M','Lakshmi D','Manoj T','Nandini G','Om P'];
    const depts = ['Computer Science','Information Science','Electronics','Mechanical','Civil'];
    for (let i = 0; i < studentNames.length; i++) {
      const deptIds = [deptCS.id, deptIS.id, deptEC.id, deptME.id, deptCV.id];
      const s = await db.user.create({ data: { name: studentNames[i], email: `${studentNames[i].toLowerCase().replace(' ','.')}@vvce.ac.in`, passwordHash: simpleHash('student123'), role: 'STUDENT', departmentId: deptIds[i % 5], usn: `4VV22CS${String(i+1).padStart(3,'0')}`, approvalStatus: 'APPROVED' } });
      students.push(s);
    }

    const club1 = await db.club.create({ data: { name: 'CodeCrafters', slug: 'codecrafters', description: 'The premier coding and competitive programming club of VVCE. We hack, we code, we conquer.', category: 'TECHNICAL', facultyAdvisorId: faculty1.id, departmentId: deptCS.id, foundedYear: 2019, mission: 'To foster a culture of coding excellence and innovation among VVCE students, empowering them to solve real-world problems through technology.', vision: 'To become the most active and impactful technical club in the region, producing nationally competitive programmers and innovators.', highlights: JSON.stringify([{title:'Smart India Hackathon Winners', description:'3 teams won SIH 2025',icon:'🏆'},{title:'500+ Members', description:'Largest tech club on campus',icon:'📈'},{title:'Weekly Code Nights', description:'Every Friday at 7 PM',icon:'🌙'}]), contactEmail: 'codecrafters@vvce.ac.in' } });
    const club2 = await db.club.create({ data: { name: 'Rangataranga', slug: 'rangataranga', description: 'VVCEs vibrant cultural club celebrating art, music, dance, and theater.', category: 'CULTURAL', facultyAdvisorId: faculty2.id, departmentId: deptEC.id, foundedYear: 2018, mission: 'To celebrate and nurture artistic expression, making cultural activities accessible to every student at VVCE.', vision: 'A campus where creativity thrives and every student discovers their artistic voice.', highlights: JSON.stringify([{title:'Fest Winners', description:'Inter-college cultural fest champions 2024',icon:'🎭'},{title:'Annual Musical', description:'Sold-out performances every year',icon:'🎵'}]), contactEmail: 'rangataranga@vvce.ac.in' } });
    const club3 = await db.club.create({ data: { name: 'RoboVikas', slug: 'robovikas', description: 'Robotics and IoT club building the future. From line followers to autonomous drones.', category: 'TECHNICAL', facultyAdvisorId: faculty1.id, departmentId: deptCS.id, foundedYear: 2020, mission: 'To build the next generation of robotics engineers through hands-on projects and competitions.', vision: 'A fully-equipped robotics lab producing award-winning autonomous systems.', contactEmail: 'robovikas@vvce.ac.in' } });
    const club4 = await db.club.create({ data: { name: 'SportX', slug: 'sportx', description: 'The sports and fitness club. Cricket, football, basketball, athletics - we play it all.', category: 'SPORTS', facultyAdvisorId: faculty2.id, departmentId: deptEC.id, foundedYear: 2017, contactEmail: 'sportx@vvce.ac.in' } });
    const club5 = await db.club.create({ data: { name: 'GreenWave', slug: 'greenwave', description: 'Environmental and social responsibility club. Making VVCE and Mysuru greener.', category: 'SOCIAL', facultyAdvisorId: faculty1.id, departmentId: deptCS.id, foundedYear: 2021, mission: 'To create environmental awareness and drive sustainability initiatives in our campus community.', contactEmail: 'greenwave@vvce.ac.in' } });

    // Club members
    await db.clubMember.createMany({ data: [
      { userId: org1.id, clubId: club1.id, role: 'president' }, { userId: students[0].id, clubId: club1.id, role: 'secretary' }, { userId: students[1].id, clubId: club1.id, role: 'member' }, { userId: students[2].id, clubId: club1.id, role: 'member' },
      { userId: org2.id, clubId: club2.id, role: 'president' }, { userId: students[3].id, clubId: club2.id, role: 'secretary' }, { userId: students[4].id, clubId: club2.id, role: 'member' }, { userId: students[5].id, clubId: club2.id, role: 'member' },
      { userId: org3.id, clubId: club3.id, role: 'president' }, { userId: students[7].id, clubId: club3.id, role: 'member' }, { userId: students[8].id, clubId: club3.id, role: 'member' },
      { userId: students[9].id, clubId: club4.id, role: 'president' }, { userId: students[10].id, clubId: club4.id, role: 'member' },
      { userId: students[11].id, clubId: club5.id, role: 'president' }, { userId: students[12].id, clubId: club5.id, role: 'member' },
    ] });

    // Club custom roles
    const ccEventCoord = await db.clubRole.create({ data: { clubId: club1.id, name: 'Event Coordinator', description: 'Can create and manage events on behalf of the club', permissions: JSON.stringify(['CREATE_CLUB_EVENT', 'EDIT_CLUB_PAGE', 'VIEW_ANALYTICS']), color: '#06b6d4', isDefault: false, createdBy: faculty1.id } });
    const ccSocialMedia = await db.clubRole.create({ data: { clubId: club1.id, name: 'Social Media Manager', description: 'Can edit club page and post updates', permissions: JSON.stringify(['EDIT_CLUB_PAGE']), color: '#f59e0b', isDefault: false, createdBy: faculty1.id } });
    const rtEventCoord = await db.clubRole.create({ data: { clubId: club2.id, name: 'Cultural Coordinator', description: 'Can organize cultural events and manage club page', permissions: JSON.stringify(['CREATE_CLUB_EVENT', 'EDIT_CLUB_PAGE', 'MANAGE_ACHIEVEMENTS']), color: '#ec4899', isDefault: false, createdBy: faculty2.id } });

    // Assign custom roles
    await db.clubRoleAssignment.createMany({ data: [
      { clubRoleId: ccEventCoord.id, userId: students[0].id, clubId: club1.id, assignedBy: faculty1.id },
      { clubRoleId: ccSocialMedia.id, userId: students[1].id, clubId: club1.id, assignedBy: faculty1.id },
      { clubRoleId: rtEventCoord.id, userId: students[3].id, clubId: club2.id, assignedBy: faculty2.id },
    ] });

    // Club achievements
    await db.clubAchievement.createMany({ data: [
      { clubId: club1.id, title: 'Smart India Hackathon 2025 - Winners', description: 'Team CodeBreakers won the SIH 2025 with their AI-powered accessibility solution', icon: '🏆', category: 'competition', createdBy: faculty1.id },
      { clubId: club1.id, title: '1000+ GitHub Commits', description: 'Club members crossed 1000 combined commits in a single semester', icon: '📈', category: 'milestone', createdBy: faculty1.id },
      { clubId: club1.id, title: 'Best Technical Club Award 2024', description: 'Awarded by VVCE Student Council for outstanding contributions', icon: '🥇', category: 'award', createdBy: faculty1.id },
      { clubId: club2.id, title: 'Inter-College Cultural Fest Champions', description: 'Won overall championship at NITK Cultural Fest 2024', icon: '🎭', category: 'competition', createdBy: faculty2.id },
      { clubId: club2.id, title: '500+ Event Attendees', description: 'Swarasangama 2024 saw record-breaking attendance', icon: '🎵', category: 'milestone', createdBy: faculty2.id },
      { clubId: club3.id, title: 'National Robotics Championship - 3rd Place', description: 'Autonomous drone navigation challenge at IIT Bombay', icon: '🤖', category: 'competition', createdBy: faculty1.id },
      { clubId: club4.id, title: 'VTU Cricket Champions 2024', description: 'VVCE cricket team won the VTU inter-collegiate tournament', icon: '🏏', category: 'competition', createdBy: faculty2.id },
      { clubId: club5.id, title: '500 Trees Planted', description: 'Campus and neighborhood plantation drive milestone', icon: '🌳', category: 'milestone', createdBy: faculty1.id },
    ] });

    const now = new Date(); const dayMs = 86400000;
    const event1 = await db.event.create({ data: { title: 'HackVerse 2026', slug: 'hackverse-2026', description: 'VVCEs flagship 24-hour hackathon! Build innovative solutions to real-world problems. Teams of 2-4 members. Prizes worth ₹50,000. Food and refreshments provided.', category: 'HACKATHON', status: 'APPROVED', venue: 'VVCE Auditorium & Labs', venueLat: 12.3136, venueLng: 76.6499, geoFenceRadius: 500, startDate: new Date(now.getTime()+7*dayMs), endDate: new Date(now.getTime()+8*dayMs), registrationDeadline: new Date(now.getTime()+5*dayMs), maxParticipants: 200, isPublic: true, tags: 'hackathon,coding,innovation', organizerId: org1.id, clubId: club1.id, approverId: faculty1.id, approvedAt: now, eventType: 'COMPETITION' } });
    const event2 = await db.event.create({ data: { title: 'Swarasangama - Musical Night', slug: 'swarasangama', description: 'An evening of classical and contemporary music performances by VVCE students. Open mic session included.', category: 'CULTURAL', status: 'APPROVED', venue: 'VVCE Open Air Theatre', venueLat: 12.3138, venueLng: 76.6502, geoFenceRadius: 300, startDate: new Date(now.getTime()+3*dayMs), endDate: new Date(now.getTime()+3*dayMs+4*3600000), registrationDeadline: new Date(now.getTime()+2*dayMs), maxParticipants: 500, isPublic: true, tags: 'music,cultural,performance', organizerId: org2.id, clubId: club2.id, approverId: faculty2.id, approvedAt: now } });
    const event3 = await db.event.create({ data: { title: 'Arduino Workshop: IoT Basics', slug: 'arduino-iot', description: 'Hands-on workshop covering Arduino fundamentals, sensor interfacing, and IoT protocols. Take home your Arduino kit!', category: 'WORKSHOP', status: 'APPROVED', venue: 'CS Lab 301, VVCE', venueLat: 12.3135, venueLng: 76.6498, geoFenceRadius: 200, startDate: new Date(now.getTime()+10*dayMs), endDate: new Date(now.getTime()+10*dayMs+6*3600000), registrationDeadline: new Date(now.getTime()+8*dayMs), maxParticipants: 40, isPublic: true, requiresApproval: true, tags: 'arduino,iot,workshop', organizerId: org3.id, clubId: club3.id, approverId: faculty1.id, approvedAt: now } });
    const event4 = await db.event.create({ data: { title: 'VVCE Cricket Tournament', slug: 'vvce-cricket', description: 'Inter-department cricket tournament. Gather your team of 11 and compete for the VVCE Cricket Trophy!', category: 'SPORTS', status: 'LIVE', venue: 'VVCE Sports Ground', venueLat: 12.314, venueLng: 76.6505, geoFenceRadius: 400, startDate: new Date(now.getTime()-1*dayMs), endDate: new Date(now.getTime()+2*dayMs), maxParticipants: 120, isPublic: true, tags: 'cricket,sports,tournament', organizerId: students[9].id, clubId: club4.id, approverId: faculty2.id, approvedAt: new Date(now.getTime()-3*dayMs), eventType: 'COMPETITION' } });
    const event5 = await db.event.create({ data: { title: 'Green Mysuru Cleanup Drive', slug: 'green-cleanup', description: 'Join us for a campus and neighborhood cleanup drive. Gloves and bags provided. Certificate for all volunteers.', category: 'SOCIAL', status: 'APPROVED', venue: 'VVCE Main Gate', startDate: new Date(now.getTime()+5*dayMs), endDate: new Date(now.getTime()+5*dayMs+3*3600000), registrationDeadline: new Date(now.getTime()+4*dayMs), maxParticipants: 100, isPublic: true, tags: 'environment,cleanup,volunteering', organizerId: students[11].id, clubId: club5.id, approverId: faculty1.id, approvedAt: now } });
    const event6 = await db.event.create({ data: { title: 'AI/ML Seminar: Future of Intelligence', slug: 'ai-ml-seminar', description: 'Distinguished lecture series on AI and Machine Learning. Industry speakers from Google, Microsoft, and IISc.', category: 'SEMINAR', status: 'PENDING_APPROVAL', venue: 'VVCE Seminar Hall', startDate: new Date(now.getTime()+14*dayMs), endDate: new Date(now.getTime()+14*dayMs+3*3600000), maxParticipants: 150, isPublic: true, tags: 'ai,machine-learning,seminar', organizerId: org1.id, clubId: club1.id } });
    const event7 = await db.event.create({ data: { title: 'Street Play Competition', slug: 'street-play', description: 'Express creativity through powerful street plays. Theme: Social Issues in Modern India. Teams of 8-15 members.', category: 'CULTURAL', status: 'APPROVED', venue: 'VVCE Quadrangle', startDate: new Date(now.getTime()+4*dayMs), endDate: new Date(now.getTime()+4*dayMs+5*3600000), maxParticipants: 80, isPublic: true, tags: 'drama,theater,street-play', organizerId: org2.id, clubId: club2.id, approverId: faculty2.id, approvedAt: now, eventType: 'COMPETITION' } });

    // Competition config for HackVerse
    const compConfig1 = await db.competitionConfig.create({ data: { eventId: event1.id, teamMinSize: 2, teamMaxSize: 4, maxTeams: 50, allowIndividual: false, scoringType: 'CUMULATIVE' } });
    await db.competitionRound.create({ data: { competitionConfigId: compConfig1.id, roundNumber: 1, name: 'Prelims', description: 'Idea submission and initial screening', criteria: JSON.stringify([{name:'Innovation',description:'How novel is the idea?',maxScore:25,weight:1.0},{name:'Feasibility',description:'Can it be built in 24 hours?',maxScore:25,weight:1.0},{name:'Impact',description:'Real-world impact potential',maxScore:25,weight:1.0},{name:'Presentation',description:'Clarity of pitch',maxScore:25,weight:1.0}]), maxScore: 100, weight: 0.3, isElimination: true, advanceCount: 20 } });
    await db.competitionRound.create({ data: { competitionConfigId: compConfig1.id, roundNumber: 2, name: 'Hackathon', description: '24-hour build phase', criteria: JSON.stringify([{name:'Completeness',description:'Working prototype quality',maxScore:30,weight:1.0},{name:'Code Quality',description:'Clean, maintainable code',maxScore:20,weight:1.0},{name:'Innovation',description:'Unique approach',maxScore:25,weight:1.0},{name:'UX',description:'User experience',maxScore:25,weight:1.0}]), maxScore: 100, weight: 0.7, isElimination: false } });

    // Competition config for Cricket
    const compConfig4 = await db.competitionConfig.create({ data: { eventId: event4.id, teamMinSize: 11, teamMaxSize: 15, maxTeams: 8, allowIndividual: false, scoringType: 'CUMULATIVE' } });
    await db.competitionRound.create({ data: { competitionConfigId: compConfig4.id, roundNumber: 1, name: 'League Stage', description: 'Round-robin matches', maxScore: 2, weight: 1.0, isElimination: false } });
    await db.competitionRound.create({ data: { competitionConfigId: compConfig4.id, roundNumber: 2, name: 'Semi-Finals', description: 'Top 4 teams', maxScore: 2, weight: 1.0, isElimination: true, advanceCount: 2 } });
    await db.competitionRound.create({ data: { competitionConfigId: compConfig4.id, roundNumber: 3, name: 'Finals', description: 'Championship match', maxScore: 2, weight: 1.0, isElimination: false } });

    // Competition config for Street Play
    const compConfig7 = await db.competitionConfig.create({ data: { eventId: event7.id, teamMinSize: 8, teamMaxSize: 15, maxTeams: 6, allowIndividual: false, scoringType: 'AVERAGE' } });
    await db.competitionRound.create({ data: { competitionConfigId: compConfig7.id, roundNumber: 1, name: 'Performance', description: 'Main stage performance', criteria: JSON.stringify([{name:'Theme Relevance',description:'How well it addresses social issues',maxScore:25,weight:1.0},{name:'Acting',description:'Quality of performance',maxScore:25,weight:1.0},{name:'Script',description:'Originality and depth of script',maxScore:25,weight:1.0},{name:'Audience Impact',description:'Emotional resonance',maxScore:25,weight:1.0}]), maxScore: 100, weight: 1.0, isElimination: false } });

    // Event roles for HackVerse
    const judgeRole = await db.eventRole.create({ data: { eventId: event1.id, name: 'Judge', description: 'Evaluates hackathon projects and assigns scores', permissions: JSON.stringify(['SCORE_PARTICIPANTS', 'VIEW_RESULTS']), color: '#8b5cf6', maxAssignees: 5, createdBy: org1.id } });
    const volunteerRole = await db.eventRole.create({ data: { eventId: event1.id, name: 'Volunteer', description: 'Helps with event logistics and check-in', permissions: JSON.stringify(['CHECK_IN_ATTENDEES']), color: '#22c55e', maxAssignees: 20, createdBy: org1.id } });
    const mentorRole = await db.eventRole.create({ data: { eventId: event1.id, name: 'Mentor', description: 'Guides teams during the hackathon', permissions: JSON.stringify(['VIEW_RESULTS']), color: '#f59e0b', maxAssignees: 10, createdBy: org1.id } });

    // Assign event roles
    await db.eventRoleAssignment.createMany({ data: [
      { eventRoleId: judgeRole.id, userId: faculty1.id, assignedBy: org1.id },
      { eventRoleId: volunteerRole.id, userId: students[0].id, assignedBy: org1.id },
      { eventRoleId: volunteerRole.id, userId: students[1].id, assignedBy: org1.id },
      { eventRoleId: mentorRole.id, userId: org3.id, assignedBy: org1.id },
    ] });

    // Event roles for Street Play
    const evaluatorRole = await db.eventRole.create({ data: { eventId: event7.id, name: 'Evaluator', description: 'Scores street play performances based on criteria', permissions: JSON.stringify(['SCORE_PARTICIPANTS', 'VIEW_RESULTS']), color: '#ec4899', maxAssignees: 3, createdBy: org2.id } });
    await db.eventRoleAssignment.create({ data: { eventRoleId: evaluatorRole.id, userId: faculty2.id, assignedBy: org2.id } });

    // Registrations
    const regData: any[] = [];
    for (let i = 0; i < 8; i++) { const r = await db.eventRegistration.create({ data: { eventId: event4.id, userId: students[i].id, status: 'CONFIRMED', qrCode: `NEXEVENT-${event4.id}-${students[i].id}-${Date.now().toString(36)}`, confirmedAt: now } }); regData.push(r); }
    for (let i = 0; i < 5; i++) { await db.attendance.create({ data: { registrationId: regData[i].id, eventId: event4.id, userId: students[i].id, status: i < 4 ? 'PRESENT' : 'LATE', checkInTime: new Date(now.getTime()-(4-i)*3600000), isWithinGeoFence: true } }); }

    await db.eventRegistration.create({ data: { eventId: event1.id, userId: students[0].id, status: 'CONFIRMED', qrCode: `QR-${event1.id}-${students[0].id}`, confirmedAt: now } });
    await db.eventRegistration.create({ data: { eventId: event1.id, userId: students[1].id, status: 'CONFIRMED', qrCode: `QR-${event1.id}-${students[1].id}`, confirmedAt: now } });
    await db.eventRegistration.create({ data: { eventId: event2.id, userId: students[2].id, status: 'CONFIRMED', qrCode: `QR-${event2.id}-${students[2].id}`, confirmedAt: now } });
    await db.eventRegistration.create({ data: { eventId: event2.id, userId: students[3].id, status: 'CONFIRMED', qrCode: `QR-${event2.id}-${students[3].id}`, confirmedAt: now } });
    await db.eventRegistration.create({ data: { eventId: event5.id, userId: students[12].id, status: 'CONFIRMED', qrCode: `QR-${event5.id}-${students[12].id}`, confirmedAt: now } });

    // Teams for HackVerse competition
    const team1 = await db.team.create({ data: { eventId: event1.id, name: 'CodeBreakers', teamCode: 'HV-TEAM-001', leaderId: students[0].id, status: 'CONFIRMED' } });
    const team2 = await db.team.create({ data: { eventId: event1.id, name: 'ByteWizards', teamCode: 'HV-TEAM-002', leaderId: students[2].id, status: 'CONFIRMED' } });
    await db.teamMember.createMany({ data: [
      { teamId: team1.id, userId: students[0].id }, { teamId: team1.id, userId: students[1].id },
      { teamId: team2.id, userId: students[2].id }, { teamId: team2.id, userId: students[3].id },
    ] });

    await db.notification.createMany({ data: [
      { userId: org1.id, title: 'Event Approved!', message: 'Your event "HackVerse 2026" has been approved by Dr. Priya Sharma.', type: 'success' },
      { userId: org1.id, title: 'New Registration', message: 'Aditi N has registered for HackVerse 2026.', type: 'info' },
      { userId: org2.id, title: 'Event Approved!', message: 'Your event "Swarasangama" has been approved.', type: 'success' },
      { userId: org1.id, title: 'Pending Approval', message: 'Your event "AI/ML Seminar" is awaiting faculty approval.', type: 'warning' },
      // Notifications for students
      { userId: students[0].id, title: 'Registration Confirmed!', message: 'You have been registered for HackVerse 2026. Don\'t forget to check in!', type: 'success' },
      { userId: students[0].id, title: 'New Club Role', message: 'You have been assigned the "Event Coordinator" role in CodeCrafters.', type: 'info' },
      { userId: students[2].id, title: 'Event Starting Soon', message: 'Swarasangama - Musical Night starts in 3 days. Get ready!', type: 'warning' },
      { userId: students[4].id, title: 'Welcome to NexEvent!', message: 'Your account has been created. Explore campus events and join clubs!', type: 'info' },
      { userId: students[9].id, title: 'Cricket Tournament Live!', message: 'VVCE Cricket Tournament is now live. Check the score updates.', type: 'info' },
      { userId: students[11].id, title: 'Registration Confirmed!', message: 'You have been registered for Green Mysuru Cleanup Drive.', type: 'success' },
      // Notifications for admin
      { userId: admin.id, title: 'New Event Pending Approval', message: 'A new event "AI/ML Seminar: Future of Intelligence" needs your review.', type: 'warning' },
      { userId: admin.id, title: 'System Status', message: 'All systems operational. 7 events and 5 clubs active on the platform.', type: 'info' },
      // Notifications for faculty
      { userId: faculty1.id, title: 'Event Role Assigned', message: 'You have been assigned as Judge for HackVerse 2026.', type: 'info' },
      { userId: faculty2.id, title: 'Event Role Assigned', message: 'You have been assigned as Evaluator for Street Play Competition.', type: 'info' },
      { userId: faculty2.id, title: 'Club Activity', message: 'Rangataranga has 4 upcoming events. Check the club page for details.', type: 'info' },
    ] });

    return NextResponse.json({ message: 'Database seeded successfully!', users: 20, clubs: 5, events: 7, achievements: 8, clubRoles: 3, eventRoles: 5, teams: 2 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}
