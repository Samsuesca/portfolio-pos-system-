--
-- PostgreSQL database dump
--

\restrict B0no5I5O7LKieTrhI0GzYrRUc6kbJtRP4SRp2yNERHveFAlWjWNTLvPlAqKUxqd

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: schools; Type: TABLE DATA; Schema: public; Owner: uniformes_user
--

INSERT INTO public.schools VALUES ('050f6088-9ae2-41a3-a415-84c669250169', 'DEMO-001', 'Colegio Demo', NULL, '#1E40AF', '#10B981', 'Calle 123 #45-67, Bogotá', '3001234567', 'contacto@colegiodemo.edu.co', '{"currency": "COP", "tax_rate": 19.0, "max_credit_days": 30, "allow_credit_sales": true, "commission_per_garment": 5000.0}', true, '2025-10-20 19:35:05.352715', '2025-10-20 19:35:05.352717');
INSERT INTO public.schools VALUES ('499b95b0-9126-42cf-a83b-a39f78624efc'