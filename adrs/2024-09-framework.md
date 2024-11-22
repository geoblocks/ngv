# ADR: opensource framework targetting developers

## Decision

We will provide a framework including:

- developper environment;
- CI;
- Production-ready Docker images;
- Turn-key apps + ability to easily create a new app;

Usage will be:

- configure;
- or fork.

This framework will be opensource, developed by a community of actors on github.

We are targetting developers.

## Context

CesiumJS is a powerful library for displaying large datasets in a realistic 3D globe.
But to create an application there is still a lot of code to write, again and again.

We think that there is space for an opensource solution to fill this gap.
Notably a lightweight solution not hidding the underlying libraries.

## Options

- create a library of components, published on npm;
- create a closed source solution;
- target non-devs with a completly dynamic / publisher solution;
- expose a simplified API.

# Justification

- by providing a complete solution we share more and it is easier and faster to use;
- a closed source solution would have no traction nor community;
- completly dynamic systems are slow, harder to do write and have higher complexity;
- a simplified API is never enough and require documentation of its own, it's a moving target.
