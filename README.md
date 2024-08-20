# Next-Gen-3D-Viewer applications framework

## Introduction

NGV is a framework to produce geospatial web applications.

It features a set of independant components and a standardized way to use them in your custom application.
A few turn-key applications are provided, easily customizable without code.
It also includes production-ready Dockerfiles to go from dev to prod in a breeze.

This project targets developers: it should be a joy to work with it and deliver value.

We think there is a space for a next-gen 3d viewer software that would both provide:

- a turn-key solution allowing declarative configuration;
- a stable and highly extensible foundation for building custom solutions.

The "modern" touch comes from today's advances of the technology (CSS vars, typescript, dynamic imports, web components...) but also in term of architectural approach.

## Turn-key applications

We provide web applications customized using a json file, CSS variables, graphic resources.
These are focused on a particular use-case.

- [Digital twins: building permits](./src/apps/buildings/README.md)

# Application builder

This repository is an application builder targeting developers.
It strives to make it easy and natural for developers to customize, build and provide value.

For advanced customization of creating new apps simply fork the repository and start delivering, immediately.

## Deployment

See the provided [Dockerfile][./Dockerfile].

## Current status

We are at the early stage of implementation.

## Participating

This is a geoblocks project, open to anyone.

See [CONTRIBUTINGS.md](./CONTRIBUTING.md).

## How it integrates with the geoblocks philosophy

Geoblocks is about providing unopiniated reusable building blocks.
This project builds on top of these blocks to allow creating apps in a reusable way.
