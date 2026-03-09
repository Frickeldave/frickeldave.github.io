---
agent: 'agent'
description: 'Aktiviere die docs für Kubernetes Trainingsinhalte'
model: Claude Opus 4.5 (Preview) (copilot)
---

## Plan
Es sollen für eine 2-tägige Schulung Kubernetes Trainingsinhalte in die Dokumentation integriert werden. Dabei sind die Trainingsinhalte entsprechend zu strukturieren. Die folgende Liste ist der Schritt-für-Schritt Plan zur Integration der Trainingsinhalte. Jeder Tag der Schulung soll insgesamt 7 Stunden effektive Arbeitszeit umfassen. 1 Stunde ist MIttagspause, 2 15 Minuten Pausen am Vor- und am Nachmittag sind ebenfalls einzuplanen. Zusätzlich soll es ein Kapitel geben, was das Aufsetzen einer Trainings-Umgebung beschreibt, die ich aber dann manuell befülle.

Aufgaben für die Erstellung der Kubernetes Trainingsinhalte:

- Analysiere die Website https://linsenraum.de/KubernetesCamp/. Wichtig für mich ist Basis 1, Basis 2. Inhalte fasse ich unten nochmal zusammen.
- Aktiviere die docs, so dass diese über das Menü anklickbar sind
- Erstelle den Unterordner /src/content/docs/kubernetes-basis/
- Erstelle eine Datei für Tag 1 und eine Datei für Tag 2 im Ordner /src/content/docs/kubernetes-basis/
- Füge die extrahierten Trainingsinhalte in die beiden Dateien ein
8) Erstelle eine Übersichtsseite /src/content/docs/kubernetes-basis/-index.md mit einer kurzen Beschreibung der Schulung und Links zu den beiden Tagen

Inhalte des Trainings

Tag 1 – Grundlagen & Einstieg
Begrüßung, Ziele, Überblick: Was ist Kubernetes, wofür brauche ich es, wie fügt es sich in DevOps/Cloud ein?

Kubernetes-Grundkonzepte und Begriffe: Cluster, Node, Control Plane, Worker, Pod, Deployment, Service, Namespace.

Erste Schritte am eigenen 3‑Knoten‑Cluster: Zugriff einrichten, kubectl nutzen, Namespaces anlegen, erstes Deployment ausrollen und aktualisieren.

Tag 2 – Workloads, Services & Networking
Pods im Detail: Aufbau eines Pods, Container in Pods, Health Checks (Liveness/Readiness), grundlegendes Scheduling-Verhalten.
​
Deployments und ReplicaSets: Rollouts, Rollbacks, Skalierung von Anwendungen, typische Deployment-Strategien.

Services, DNS & Service Discovery: Service-Typen, interne Erreichbarkeit, Namensauflösung im Cluster, erste Schritte Richtung Ingress.